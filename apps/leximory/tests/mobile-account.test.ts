import assert from 'node:assert/strict'
import { test } from 'node:test'
import { accountSettingsSchema } from '@repo/api'
import { mobileSubjectSchema } from '@repo/schema/mobile'
import { createAccountOperations, type AccountScope, type AccountStore } from '../server/mobile/account'
import { MobileError } from '../server/mobile/errors'
import { testMobileHandler } from './helpers/mobile'

const subject = mobileSubjectSchema.parse({ userId: 'account-reader' })
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64')
const settings = accountSettingsSchema.parse({
    userId: subject.userId,
    plan: 'beginner',
    username: 'Reader',
    image: null,
    email: 'reader@example.test',
    createdAt: '2026-10-14T00:00:00Z',
    planLabel: 'Beginner',
    balance: 20,
    dailyAmount: 5,
    hasClaimed: false,
    accent: 'BrE',
    activity: [{ date: '2026-10-14', count: 2 }],
    today: '2026-10-14',
    definitions: { used: 2, limit: 10, resetsIn: 300 },
    audio: { used: 0, limit: 10, resetsIn: -2 },
    subscriptionPlans: [],
})

function request(path = '', body?: unknown, authenticated = true, method = path ? 'POST' : 'GET') {
    return new Request(`https://leximory.test/api/mobile/v1/account${path}`, {
        method,
        headers: { ...(authenticated ? { authorization: 'Bearer verified' } : {}), 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
}

function harness(overrides: Partial<AccountStore> = {}) {
    const calls: { operation: keyof AccountStore; scope: AccountScope; input?: unknown }[] = []
    const record = (operation: keyof AccountStore, scope: AccountScope, input?: unknown) => {
        calls.push({ operation, scope, input })
    }
    const store: AccountStore = {
        settings: async (scope) => {
            record('settings', scope)
            return settings
        },
        accent: async (scope, value) => {
            record('accent', scope, value)
        },
        claim: async (scope) => {
            record('claim', scope)
            return '领取成功，LexiCoin + 5'
        },
        token: async (scope) => {
            record('token', scope)
            return 'account-token'
        },
        revoke: async (scope) => {
            record('revoke', scope)
        },
        avatar: async (scope, bytes, contentType) => {
            record('avatar', scope, { bytes: Array.from(bytes), contentType })
            return 'https://leximory.test/avatars/account-reader'
        },
        checkout: async (scope, plan) => {
            record('checkout', scope, plan)
            return 'https://payments.test/checkout'
        },
        billing: async (scope) => {
            record('billing', scope)
            return 'https://payments.test/billing'
        },
        ...overrides,
    }
    const handler = testMobileHandler(createAccountOperations(store), async () => ({ kind: 'authenticated', subject }))
    return { calls, handler }
}

const validRequests = () => [
    request(),
    request('/accent', { accent: 'AmE' }),
    request('/claim'),
    request('/token'),
    request('/revoke-token'),
    request('/avatar', { data: jpeg, contentType: 'image/jpeg' }),
    request('/checkout', { plan: 'polyglot' }),
    request('/billing'),
]

test('every account operation passes only the verified subject and signal to its store', async () => {
    const h = harness()
    for (const input of validRequests()) {
        const response = await h.handler(input)
        assert.equal(response.status, 200)
        assert.equal(response.headers.get('cache-control'), 'private, no-store')
    }
    assert.deepEqual(
        h.calls.map((call) => call.operation),
        ['settings', 'accent', 'claim', 'token', 'revoke', 'avatar', 'checkout', 'billing'],
    )
    for (const call of h.calls) {
        assert.deepEqual(call.scope.subject, subject)
        assert.ok(call.scope.signal instanceof AbortSignal)
        assert.deepEqual(Object.keys(call.scope).sort(), ['signal', 'subject'])
    }
    assert.equal(h.calls[1]?.input, 'AmE')
    assert.deepEqual(h.calls[5]?.input, { bytes: [255, 216, 255, 217], contentType: 'image/jpeg' })
    assert.equal(h.calls[6]?.input, 'polyglot')
})

test('unauthenticated account requests never invoke the store', async () => {
    const h = harness()
    for (const input of validRequests()) {
        input.headers.delete('authorization')
        const response = await h.handler(input)
        assert.equal(response.status, 401)
    }
    assert.deepEqual(h.calls, [])
})

test('all account operations reject unknown query parameters before the store', async () => {
    const h = harness()
    for (const input of validRequests()) {
        const url = new URL(input.url)
        url.searchParams.set('userId', 'forged-owner')
        const response = await h.handler(
            new Request(url, {
                method: input.method,
                headers: input.headers,
                ...(input.body ? { body: await input.text() } : {}),
            }),
        )
        assert.equal(response.status, 400)
        assert.equal((await response.json()).error.code, 'invalid_input')
    }
    assert.deepEqual(h.calls, [])
})

test('account inputs reject forged owners and invalid domain values before the store', async () => {
    const h = harness()
    const inputs = [
        request('/accent', { accent: 'AmE', userId: 'forged-owner' }),
        request('/avatar', { data: jpeg, contentType: 'image/jpeg', userId: 'forged-owner' }),
        request('/checkout', { plan: 'polyglot', userId: 'forged-owner' }),
        request('/accent', { accent: 'invalid' }),
        request('/checkout', { plan: 'beginner' }),
        request('/avatar', { data: jpeg, contentType: 'image/png' }),
    ]
    for (const input of inputs) assert.equal((await h.handler(input)).status, 400)
    assert.deepEqual(h.calls, [])
})

test('bodyless account mutations reject unexpected payloads and misleading content lengths', async () => {
    const h = harness()
    for (const path of ['/claim', '/token', '/revoke-token', '/billing']) {
        assert.equal((await h.handler(request(path, { userId: 'forged-owner' }))).status, 400)
        const input = request(path)
        input.headers.set('content-length', '100')
        assert.equal((await h.handler(input)).status, 400)
    }
    assert.deepEqual(h.calls, [])
})

test('avatar requests reject empty, non-JPEG and oversized data before upload', async () => {
    const h = harness()
    const tooLarge = Buffer.alloc(1024 * 1024 + 1, 0xff)
    tooLarge[1] = 0xd8
    for (const data of ['', Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64'), tooLarge.toString('base64')]) {
        const response = await h.handler(request('/avatar', { data, contentType: 'image/jpeg' }))
        assert.equal(response.status, 400)
    }
    assert.deepEqual(h.calls, [])
})

test('account JSON inputs reject malformed and excessive bodies before the store', async () => {
    const h = harness()
    const invalid = request('/accent')
    const response = await h.handler(
        new Request(invalid.url, {
            method: 'POST',
            headers: invalid.headers,
            body: '{invalid',
        }),
    )
    assert.equal(response.status, 400)
    assert.equal((await h.handler(request('/checkout', { plan: 'polyglot', padding: 'x'.repeat(2048) }))).status, 400)
    assert.deepEqual(h.calls, [])
})

test('daily claim responses preserve both awarded and already-claimed messages', async () => {
    for (const message of ['领取成功，LexiCoin + 5', '今日已领取']) {
        const h = harness({ claim: async () => message })
        const response = await h.handler(request('/claim'))
        assert.equal(response.status, 200)
        assert.deepEqual(await response.json(), { message })
    }
})

test('account store conflicts and inaccessible billing retain their domain status', async () => {
    for (const [path, overrides, status] of [
        [
            '/claim',
            {
                claim: async () => {
                    throw new MobileError('stale_revision')
                },
            },
            409,
        ],
        [
            '/billing',
            {
                billing: async () => {
                    throw new MobileError('inaccessible')
                },
            },
            404,
        ],
    ] satisfies [string, Partial<AccountStore>, number][]) {
        const response = await harness(overrides).handler(request(path))
        assert.equal(response.status, status)
    }
})

test('invalid provider outputs and outages are retryable server failures', async () => {
    const cases: [Request, Partial<AccountStore>][] = [
        [request(), { settings: async () => ({ ...settings, definitions: { ...settings.definitions, used: -1 } }) }],
        [request('/token'), { token: async () => '' }],
        [request('/claim'), { claim: async () => '' }],
        [request('/avatar', { data: jpeg, contentType: 'image/jpeg' }), { avatar: async () => 'invalid-url' }],
        [request('/checkout', { plan: 'polyglot' }), { checkout: async () => 'invalid-url' }],
        [request('/billing'), { billing: async () => 'invalid-url' }],
        [
            request('/claim'),
            {
                claim: async () => {
                    throw new Error('provider unavailable')
                },
            },
        ],
    ]
    for (const [input, overrides] of cases) {
        const response = await harness(overrides).handler(input)
        assert.equal(response.status, 503)
        assert.equal((await response.json()).error.retryable, true)
    }
})
