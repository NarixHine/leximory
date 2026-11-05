import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { APPLE_PRODUCTS } from '@repo/env/billing'
import {
    appleTransaction,
    appleSnapshot,
    appleEvidenceSnapshot,
    resolveMembership,
    type AppleSnapshot,
} from '@repo/user/entitlements'
import {
    createAppleBilling,
    AppleBillingError,
    type AppleGateway,
    type AppleRepository,
} from '../server/billing/service'
import { createAppleNotificationHandler } from '../server/billing/notifications'
import { createAppleVerification } from '../server/billing/verification'
import { createAppleBillingOperations } from '../server/mobile/apple-billing'
import { mobileSubjectSchema } from '@repo/schema/mobile'
import { testMobileHandler } from './helpers/mobile'

const userId = 'b0272ed1-61c6-48e9-9e35-acb21d8392cc'
const other = '037b2ba7-70cc-41d6-b64c-b9e9b236e1cf'
const now = 1800000000000
const transaction = (changes = {}) =>
    appleTransaction.parse({
        transactionId: '101',
        originalTransactionId: '100',
        bundleId: 'com.leximory.reader',
        productId: APPLE_PRODUCTS.bilingual,
        subscriptionGroupIdentifier: 'group',
        appAccountToken: userId,
        environment: 'Production',
        type: 'Auto-Renewable Subscription',
        purchaseDate: now - 1000,
        expiresDate: now + 10000,
        signedDate: now,
        ...changes,
    })
const jws = (value: unknown) => `test.${Buffer.from(JSON.stringify(value)).toString('base64url')}.signature`
const snapshot = (changes: Record<string, unknown> = {}): AppleSnapshot =>
    appleSnapshot.parse({
        environment: 'Production',
        original_transaction_id: '100',
        user_id: userId,
        status: 1,
        signed_transaction_info: jws(transaction()),
        signed_renewal_info: jws({
            originalTransactionId: '100',
            environment: 'Production',
            signedDate: now,
            autoRenewStatus: 1,
        }),
        version: 1,
        verified_at: new Date(now).toISOString(),
        ...changes,
    })
const membership = (row: AppleSnapshot, extra = {}) =>
    resolveMembership({ userId, legacyPlan: 'beginner', snapshots: [row], sandboxAllowed: false, now, ...extra })

test('access expires at the signed deadline without a cron job; cancellation preserves the paid interval', () => {
    const row = snapshot({
        signed_renewal_info: jws({
            originalTransactionId: '100',
            environment: 'Production',
            signedDate: now,
            autoRenewStatus: 0,
        }),
    })
    assert.equal(membership(row).plan, 'bilingual')
    assert.equal(membership(row).memberships[0]?.autoRenews, false)
    assert.equal(membership(row, { now: now + 10000 }).plan, 'beginner')
})
test('grace grants access only through its deadline; retry, expiry, upgrade, and revocation do not', () => {
    const row = snapshot({
        status: 4,
        signed_renewal_info: jws({
            originalTransactionId: '100',
            environment: 'Production',
            signedDate: now,
            autoRenewStatus: 1,
            gracePeriodExpiresDate: now + 20000,
        }),
    })
    assert.equal(membership(row).plan, 'bilingual')
    assert.equal(membership(row, { now: now + 20000 }).plan, 'beginner')
    assert.equal(
        membership({ ...row, signed_transaction_info: jws(transaction({ purchaseDate: now + 1000 })) }).plan,
        'beginner',
    )
    for (const status of [2, 3, 5]) assert.equal(membership(snapshot({ status })).plan, 'beginner')
    for (const change of [{ isUpgraded: true }, { revocationDate: now - 1 }]) {
        assert.equal(membership(snapshot({ signed_transaction_info: jws(transaction(change)) })).plan, 'beginner')
    }
})
test('sources raise a ceiling without stacking and preserve the internal highest plan', () => {
    const rows = [
        snapshot(),
        snapshot({
            original_transaction_id: '200',
            signed_transaction_info: jws(
                transaction({ originalTransactionId: '200', productId: APPLE_PRODUCTS.polyglot }),
            ),
            signed_renewal_info: jws({
                originalTransactionId: '200',
                environment: 'Production',
                signedDate: now,
                autoRenewStatus: 1,
            }),
        }),
    ]
    assert.equal(
        resolveMembership({ userId, legacyPlan: 'beginner', snapshots: rows, sandboxAllowed: false, now }).plan,
        'polyglot',
    )
    assert.equal(membership(snapshot(), { legacyPlan: 'leximory' }).plan, 'leximory')
    assert.equal(membership(snapshot(), { legacyPlan: 'polyglot' }).purchaseEligible, false)
    assert.equal(membership(snapshot({ user_id: other })).plan, 'beginner')
})
test('Sandbox access requires a server-controlled test cohort', () => {
    const row = snapshot({
        environment: 'Sandbox',
        signed_transaction_info: jws(transaction({ environment: 'Sandbox' })),
        signed_renewal_info: jws({
            originalTransactionId: '100',
            environment: 'Sandbox',
            signedDate: now,
            autoRenewStatus: 1,
        }),
    })
    assert.equal(membership(row).plan, 'beginner')
    assert.equal(membership(row, { sandboxAllowed: true }).plan, 'bilingual')
})
function harness() {
    let row: AppleSnapshot | null = null
    let commits = 0
    let latestCalls = 0
    let conflict = false
    const repository: AppleRepository = {
        async read() {
            return row ? { ...row } : null
        },
        async commit(previous, next) {
            if (conflict) {
                conflict = false
                row = snapshot({ version: 10 })
                return false
            }
            if (row && row.version !== previous?.version) return false
            row = next
            commits++
            return true
        },
    }
    const gateway: AppleGateway = {
        async transaction() {
            return transaction()
        },
        async latest() {
            latestCalls++
            return appleEvidenceSnapshot.parse(snapshot())
        },
    }
    return {
        service: createAppleBilling({ gateway, repository, sandboxAllowed: () => false, now: () => now }),
        gateway,
        set(value: AppleSnapshot | null) {
            row = value
        },
        conflict() {
            conflict = true
        },
        get row() {
            return row
        },
        get commits() {
            return commits
        },
        get latestCalls() {
            return latestCalls
        },
    }
}
test('replayed transactions acknowledge only committed, non-additive snapshots', async () => {
    const h = harness()
    assert.deepEqual(await h.service.deliver(userId, 'verified'), { acknowledgedTransactionId: '101' })
    assert.deepEqual(await h.service.deliver(userId, 'verified'), { acknowledgedTransactionId: '101' })
    assert.equal(h.row?.version, 2)
    assert.equal(h.row?.user_id, userId)
    assert.equal(h.row?.status, 1)
})
test('wrong-account and deleted-owner transactions never commit or transfer ownership', async () => {
    const h = harness()
    await assert.rejects(h.service.deliver(other, 'verified'), { reason: 'owner' })
    for (const owner of [other, null]) {
        h.set(
            snapshot({
                user_id: owner,
                ...(owner === null ? { status: null, signed_transaction_info: null, signed_renewal_info: null } : {}),
            }),
        )
        await assert.rejects(h.service.deliver(userId, 'verified'), { reason: 'owner' })
    }
    assert.equal(h.commits, 0)
})
test('a version conflict re-fetches Apple evidence and retries with the new version', async () => {
    const h = harness()
    h.set(snapshot())
    h.conflict()
    await h.service.deliver(userId, 'verified')
    assert.equal(h.latestCalls, 2)
    assert.equal(h.row?.version, 11)
})
test('stale signed evidence cannot overwrite newer revocation evidence', async () => {
    const h = harness()
    h.set(
        snapshot({
            status: 5,
            signed_transaction_info: jws(transaction({ signedDate: now + 1000, revocationDate: now })),
        }),
    )
    await h.service.deliver(userId, 'verified')
    assert.equal(h.row?.status, 5)
    assert.equal(h.commits, 0)
})
test('Apple status lag never acknowledges a newer purchase that has not appeared yet', async () => {
    const h = harness()
    h.gateway.transaction = async () => transaction({ transactionId: '102', purchaseDate: now + 1 })
    await assert.rejects(h.service.deliver(userId, 'newly-purchased'), { reason: 'unavailable' })
    assert.equal(h.commits, 0)
})
test('failed persistence and cancellation cannot acknowledge a transaction', async () => {
    const h = harness()
    h.gateway.latest = async () => {
        throw new Error('Apple unavailable')
    }
    await assert.rejects(h.service.deliver(userId, 'verified'), /Apple unavailable/)
    const controller = new AbortController()
    controller.abort()
    await assert.rejects(h.service.deliver(userId, 'verified', controller.signal))
    assert.equal(h.commits, 0)
})
test('real mobile purchase route enforces authentication, bounded strict input, ownership errors and checked output', async () => {
    let calls = 0
    const subject = mobileSubjectSchema.parse({ userId })
    const handler = testMobileHandler(
        createAppleBillingOperations({
            async deliver(owner, signed) {
                calls++
                assert.equal(owner, userId)
                if (signed === 'other') throw new AppleBillingError('owner')
                return { acknowledgedTransactionId: signed === 'bad-output' ? '' : '101', plan: 'bilingual' }
            },
        }),
        async () => ({ kind: 'authenticated', subject }),
    )
    const request = (body: unknown, authenticated = true) =>
        new Request('https://leximory.test/api/mobile/v1/account/apple-transaction', {
            method: 'POST',
            headers: authenticated ? { authorization: 'Bearer token' } : {},
            body: JSON.stringify(body),
        })
    assert.equal((await handler(request({ signedTransaction: 'verified' }, false))).status, 401)
    for (const body of [
        { signedTransaction: '' },
        { signedTransaction: 'x'.repeat(33000) },
        { signedTransaction: 'verified', userId: other },
    ])
        assert.equal((await handler(request(body))).status, 400)
    assert.equal(calls, 0)
    assert.equal((await handler(request({ signedTransaction: 'other' }))).status, 409)
    assert.equal((await handler(request({ signedTransaction: 'bad-output' }))).status, 503)
    const response = await handler(request({ signedTransaction: 'verified' }))
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.deepEqual(await response.json(), { acknowledgedTransactionId: '101', plan: 'bilingual' })
})
test('the local StoreKit catalog uses the canonical server product identifiers', async () => {
    const config = JSON.parse(
        await readFile(new URL('../../leximory-ios/StoreKit/Leximory.storekit', import.meta.url), 'utf8'),
    )
    assert.deepEqual(
        config.subscriptionGroups[0].subscriptions.map((product: { productID: string }) => product.productID).sort(),
        Object.values(APPLE_PRODUCTS).sort(),
    )
})

test('the production verification boundary rejects unsigned claims, malformed tokens, and local Xcode evidence', async () => {
    const verifier = createAppleVerification({ appId: 12345, groupId: 'group', roots: [] })
    const unsigned = `${Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url')}.${Buffer.from(JSON.stringify(transaction())).toString('base64url')}.`
    for (const input of ['not-a-jws', unsigned, jws({ ...transaction(), environment: 'Xcode' })]) {
        await assert.rejects(verifier.transaction(input, ['Production', 'Sandbox']), { reason: 'invalid' })
    }
    await assert.rejects(
        verifier.notification(
            jws({ data: { environment: 'Production' }, notificationUUID: userId, notificationType: 'TEST' }),
        ),
        { reason: 'invalid' },
    )
})

test('overlapping purchase deliveries converge without duplicate subscription rows', async () => {
    const h = harness()
    await Promise.all([h.service.deliver(userId, 'verified'), h.service.deliver(userId, 'verified')])
    assert.equal(h.row?.version, 2)
    assert.equal(h.commits, 2)
    assert.equal(h.row?.user_id, userId)
})

test('notifications acknowledge durable acceptance, strip signed evidence from queue payloads, and retry enqueue failures', async () => {
    const request = (body: unknown) =>
        new Request('https://leximory.test/api/apple/notifications', { method: 'POST', body: JSON.stringify(body) })
    const queued: unknown[] = []
    const handler = createAppleNotificationHandler({
        async verify(value) {
            if (value === 'invalid') throw new AppleBillingError('invalid')
            return {
                id: userId,
                environment: 'Production',
                chain: value === 'test' ? null : '100',
                signedPayload: value,
            }
        },
        async enqueue(notification) {
            queued.push(notification)
            if (queued.length === 2) throw new Error('Queue unavailable')
        },
    })
    assert.equal((await handler(request({ signedPayload: 'valid-jws' }))).status, 200)
    assert.deepEqual(queued[0], { id: userId, environment: 'Production', chain: '100' })
    assert.equal((await handler(request({ signedPayload: 'valid-jws' }))).status, 503)
    assert.equal((await handler(request({ signedPayload: 'invalid' }))).status, 400)
    assert.equal((await handler(request({ signedPayload: 'test' }))).status, 200)
    assert.equal((await handler(request({ signedPayload: 'x'.repeat(65000) }))).status, 400)
    assert.equal(queued.length, 2)
})

test('a newer refund is retained even when Apple returns older renewal metadata', async () => {
    const h = harness()
    const renewal = jws({
        originalTransactionId: '100',
        environment: 'Production',
        signedDate: now + 5000,
        autoRenewStatus: 0,
    })
    h.set(snapshot({ signed_renewal_info: renewal }))
    h.gateway.latest = async () =>
        appleEvidenceSnapshot.parse(
            snapshot({
                status: 5,
                signed_transaction_info: jws(transaction({ signedDate: now + 1000, revocationDate: now })),
            }),
        )
    await h.service.deliver(userId, 'verified')
    assert.equal(h.row?.status, 5)
    assert.equal(h.row?.signed_renewal_info, renewal)
    assert.equal(h.row && membership(h.row).plan, 'beginner')
})
test('a new billing period wins over a later-issued JWS for the old period', async () => {
    const h = harness()
    h.set(snapshot({ signed_transaction_info: jws(transaction({ signedDate: now + 5000 })) }))
    h.gateway.latest = async () =>
        appleEvidenceSnapshot.parse(
            snapshot({
                signed_transaction_info: jws(
                    transaction({ transactionId: '102', purchaseDate: now + 100, signedDate: now + 1000 }),
                ),
            }),
        )
    await h.service.deliver(userId, 'verified')
    assert.equal(
        h.row?.signed_transaction_info,
        jws(transaction({ transactionId: '102', purchaseDate: now + 100, signedDate: now + 1000 })),
    )
})
