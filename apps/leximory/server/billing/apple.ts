import 'server-only'
import { z } from 'zod'
import { AppStoreServerAPIClient, Environment } from '@apple/app-store-server-library'
import env from '@repo/env'
import { createPrivateKey, X509Certificate } from 'node:crypto'
import { createAppleVerification, boundedAppleRequest } from './verification'
import { APPLE_BUNDLE_ID } from '@repo/env/billing'
import { type AppleEnvironment } from '@repo/user/entitlements'
import { AppleBillingError, type AppleGateway } from './service'

const configurationSchema = z
    .object({
        APPLE_APP_ID: z.number().int().positive(),
        APPLE_SUBSCRIPTION_GROUP_ID: z.string().min(1),
        APPLE_ISSUER_ID: z.uuid(),
        APPLE_KEY_ID: z.string().min(1),
        APPLE_PRIVATE_KEY: z.string().min(1),
        APPLE_ROOT_CERTIFICATES: z.string().transform((value, context) => {
            try {
                return z
                    .array(z.string().min(1))
                    .min(1)
                    .parse(JSON.parse(value))
                    .map((cert) => Buffer.from(cert, 'base64'))
            } catch {
                context.addIssue({ code: 'custom', message: 'Expected JSON array of base64 DER root certificates' })
                return z.NEVER
            }
        }),
    })
    .superRefine((config, context) => {
        try {
            const key = createPrivateKey(config.APPLE_PRIVATE_KEY)
            if (
                key.asymmetricKeyType !== 'ec' ||
                key.asymmetricKeyDetails?.namedCurve !== 'prime256v1' ||
                config.APPLE_ROOT_CERTIFICATES.some((root) => !new X509Certificate(root).ca)
            )
                throw new Error('Invalid key or roots')
        } catch {
            context.addIssue({ code: 'custom', message: 'Invalid Apple signing key or root certificate' })
        }
    })
const configured = configurationSchema.safeParse(env)
function configuration() {
    const result = configured
    if (!result.success) throw new AppleBillingError('unavailable')
    return result.data
}
export function appleConfigured() {
    return configured.success
}
export function applePurchasesEnabled() {
    return appleConfigured() && env.APPLE_PURCHASES_ENABLED === 'true'
}

const clients = new Map<AppleEnvironment, AppStoreServerAPIClient>()
let verification: ReturnType<typeof createAppleVerification> | undefined
function verifier() {
    const config = configuration()
    verification ??= createAppleVerification({
        appId: config.APPLE_APP_ID,
        groupId: config.APPLE_SUBSCRIPTION_GROUP_ID,
        roots: config.APPLE_ROOT_CERTIFICATES,
    })
    return verification
}
function client(environment: AppleEnvironment) {
    const config = configuration()
    let instance = clients.get(environment)
    if (!instance) {
        instance = new AppStoreServerAPIClient(
            config.APPLE_PRIVATE_KEY,
            config.APPLE_KEY_ID,
            config.APPLE_ISSUER_ID,
            APPLE_BUNDLE_ID,
            environment === 'Production' ? Environment.PRODUCTION : Environment.SANDBOX,
        )
        clients.set(environment, instance)
    }
    return instance
}
export const appleGateway: AppleGateway = {
    async transaction(jws, environments) {
        return verifier().transaction(jws, environments)
    },
    async latest(environment, chain) {
        const response = await boundedAppleRequest(client(environment).getAllSubscriptionStatuses(chain))
        const item = response.data
            ?.flatMap((group) => group.lastTransactions ?? [])
            .find((item) => item.originalTransactionId === chain)
        if (!item?.signedTransactionInfo || !item.signedRenewalInfo || !item.status)
            throw new AppleBillingError('unavailable')
        const [transaction, renewal] = await Promise.all([
            verifier().transaction(item.signedTransactionInfo, [environment]),
            verifier().renewal(item.signedRenewalInfo, environment),
        ])
        if (
            transaction.environment !== environment ||
            renewal.environment !== environment ||
            transaction.originalTransactionId !== chain ||
            renewal.originalTransactionId !== chain
        )
            throw new AppleBillingError('invalid')
        return {
            environment,
            original_transaction_id: chain,
            user_id: transaction.appAccountToken.toLowerCase(),
            status: z.number().int().min(1).max(5).parse(item.status),
            signed_transaction_info: item.signedTransactionInfo,
            signed_renewal_info: item.signedRenewalInfo,
        }
    },
}
export async function appleNotification(jws: string) {
    return verifier().notification(jws)
}
export async function appleNotificationHistory(
    environment: AppleEnvironment,
    start: number,
    end: number,
    cursor: string | null,
) {
    return boundedAppleRequest(client(environment).getNotificationHistory(cursor, { startDate: start, endDate: end }))
}
