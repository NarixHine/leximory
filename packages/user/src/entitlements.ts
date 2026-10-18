import { z } from '@repo/schema'
import { APPLE_BUNDLE_ID, PLANS, applePlan, type Plan } from '@repo/env/billing'

export const appleEnvironment = z.enum(['Production', 'Sandbox'])
export type AppleEnvironment = z.infer<typeof appleEnvironment>
export const appleTransaction = z.object({
    transactionId: z.string().regex(/^\d+$/),
    originalTransactionId: z.string().regex(/^\d+$/),
    bundleId: z.literal(APPLE_BUNDLE_ID),
    productId: z.string(),
    subscriptionGroupIdentifier: z.string(),
    appAccountToken: z.uuid(),
    environment: appleEnvironment,
    type: z.literal('Auto-Renewable Subscription'),
    purchaseDate: z.number().int().nonnegative(),
    expiresDate: z.number().int().nonnegative(),
    signedDate: z.number().int().nonnegative(),
    revocationDate: z.number().int().nonnegative().optional(),
    isUpgraded: z.boolean().optional(),
})
export const appleRenewal = z.object({
    originalTransactionId: z.string(),
    environment: appleEnvironment,
    signedDate: z.number().int().nonnegative(),
    autoRenewStatus: z.union([z.literal(0), z.literal(1)]),
    gracePeriodExpiresDate: z.number().int().nonnegative().optional(),
})
export const appleEvidenceSnapshot = z.object({
    environment: appleEnvironment,
    original_transaction_id: z.string(),
    user_id: z.uuid(),
    status: z.number().int().min(1).max(5),
    signed_transaction_info: z.string(),
    signed_renewal_info: z.string(),
    version: z.number().int().positive(),
    verified_at: z.string(),
})
export const appleSnapshot = z.union([
    appleEvidenceSnapshot,
    appleEvidenceSnapshot.extend({
        user_id: z.null(),
        status: z.number().int().min(1).max(5).nullable(),
        signed_transaction_info: z.string().nullable(),
        signed_renewal_info: z.string().nullable(),
    }),
])
export type AppleSnapshot = z.infer<typeof appleSnapshot>
export type AppleMembership = {
    provider: 'appStore'
    status: 'active' | 'gracePeriod' | 'billingRetry' | 'expired' | 'revoked'
    expiresAt: string
    autoRenews: boolean
    plan: 'bilingual' | 'polyglot'
}

// Only for server-written snapshots. Untrusted incoming JWS must pass SignedDataVerifier first.
export function storedClaims<T>(schema: z.ZodType<T>, jws: string): T {
    const parts = jws.split('.')
    if (parts.length !== 3 || !parts[1]) throw new Error('Invalid stored Apple snapshot')
    const result = schema.safeParse(JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')))
    if (!result.success) throw new Error('Invalid stored Apple claims')
    return result.data
}

export function resolveMembership(input: {
    legacyPlan: unknown
    userId: string
    snapshots: AppleSnapshot[]
    sandboxAllowed: boolean
    now?: number
}) {
    const now = input.now ?? Date.now()
    const legacy = z.enum(PLANS).safeParse(input.legacyPlan ?? 'beginner')
    if (!legacy.success) throw new Error('Invalid stored legacy plan')
    const legacyPlan = legacy.data
    let plan: Plan = legacyPlan
    const memberships: AppleMembership[] = []
    for (const row of input.snapshots) {
        if (row.user_id !== input.userId || (row.environment === 'Sandbox' && !input.sandboxAllowed)) continue
        const transaction = storedClaims(appleTransaction, row.signed_transaction_info)
        const renewal = storedClaims(appleRenewal, row.signed_renewal_info)
        const tier = applePlan(transaction.productId)
        if (
            !tier ||
            transaction.appAccountToken.toLowerCase() !== input.userId.toLowerCase() ||
            transaction.environment !== row.environment ||
            renewal.environment !== row.environment ||
            transaction.originalTransactionId !== row.original_transaction_id ||
            renewal.originalTransactionId !== row.original_transaction_id
        )
            throw new Error('Inconsistent Apple snapshot')
        const graceExpiry = renewal.gracePeriodExpiresDate ?? 0
        let status: AppleMembership['status']
        if (transaction.revocationDate !== undefined || row.status === 5) status = 'revoked'
        else if (transaction.isUpgraded || transaction.purchaseDate > now) status = 'expired'
        else if (row.status === 4 && graceExpiry > now) status = 'gracePeriod'
        else if (row.status === 1 && transaction.expiresDate > now) status = 'active'
        else if (row.status === 3) status = 'billingRetry'
        else status = 'expired'
        const expiry = status === 'gracePeriod' ? graceExpiry : transaction.expiresDate
        memberships.push({
            provider: 'appStore',
            status,
            expiresAt: new Date(expiry).toISOString(),
            autoRenews: renewal.autoRenewStatus === 1,
            plan: tier,
        })
        if ((status === 'active' || status === 'gracePeriod') && PLANS.indexOf(tier) > PLANS.indexOf(plan)) plan = tier
    }
    memberships.sort((a, b) => {
        const active = (value: AppleMembership) => (value.status === 'active' || value.status === 'gracePeriod' ? 1 : 0)
        return (
            active(b) - active(a) ||
            PLANS.indexOf(b.plan) - PLANS.indexOf(a.plan) ||
            Date.parse(b.expiresAt) - Date.parse(a.expiresAt)
        )
    })
    return {
        plan,
        legacyPlan,
        memberships,
        purchaseEligible:
            legacyPlan === 'beginner' &&
            !memberships.some((m) => ['active', 'gracePeriod', 'billingRetry'].includes(m.status)),
    }
}
