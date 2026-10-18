import { z } from 'zod'
import {
    Environment,
    SignedDataVerifier,
    VerificationException,
    VerificationStatus,
} from '@apple/app-store-server-library'
import { APPLE_BUNDLE_ID, applePlan } from '@repo/env/billing'
import { appleEnvironment, appleTransaction, appleRenewal, type AppleEnvironment } from '@repo/user/entitlements'
import { AppleBillingError } from './service'

export async function boundedAppleRequest<T>(request: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
        return await Promise.race([
            request,
            new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new AppleBillingError('unavailable')), 15000)
            }),
        ])
    } finally {
        if (timer) clearTimeout(timer)
    }
}
// This untrusted value only selects a verifier. It never authorizes an environment.
function environmentHint(jws: string): AppleEnvironment {
    try {
        const payload = z
            .object({
                environment: appleEnvironment.optional(),
                data: z.object({ environment: appleEnvironment }).optional(),
            })
            .parse(JSON.parse(Buffer.from(jws.split('.')[1] ?? '', 'base64url').toString('utf8')))
        return appleEnvironment.parse(payload.environment ?? payload.data?.environment)
    } catch {
        throw new AppleBillingError('invalid')
    }
}
export function createAppleVerification(config: { appId: number; groupId: string; roots: Buffer[] }) {
    const verifiers = new Map<AppleEnvironment, SignedDataVerifier>()
    function verifier(environment: AppleEnvironment) {
        let instance = verifiers.get(environment)
        if (!instance) {
            instance = new SignedDataVerifier(
                config.roots,
                true,
                environment === 'Production' ? Environment.PRODUCTION : Environment.SANDBOX,
                APPLE_BUNDLE_ID,
                config.appId,
            )
            verifiers.set(environment, instance)
        }
        return instance
    }
    async function verified<T>(request: Promise<T>) {
        try {
            return await boundedAppleRequest(request)
        } catch (error) {
            if (
                error instanceof VerificationException &&
                error.status !== VerificationStatus.RETRYABLE_VERIFICATION_FAILURE
            )
                throw new AppleBillingError('invalid')
            throw error
        }
    }
    async function transaction(jws: string, environments: AppleEnvironment[]) {
        const environment = environmentHint(jws)
        if (!environments.includes(environment)) throw new AppleBillingError('owner')
        const parsed = appleTransaction.safeParse(await verified(verifier(environment).verifyAndDecodeTransaction(jws)))
        if (
            !parsed.success ||
            !applePlan(parsed.data.productId) ||
            parsed.data.subscriptionGroupIdentifier !== config.groupId
        )
            throw new AppleBillingError('invalid')
        return parsed.data
    }
    return {
        transaction,
        async renewal(jws: string, environment: AppleEnvironment) {
            return appleRenewal.parse(await verified(verifier(environment).verifyAndDecodeRenewalInfo(jws)))
        },
        async notification(jws: string) {
            const environment = environmentHint(jws)
            const notification = await verified(verifier(environment).verifyAndDecodeNotification(jws))
            const id = z.uuid().parse(notification.notificationUUID)
            if (notification.notificationType === 'TEST' || !notification.data?.signedTransactionInfo)
                return { id, environment, chain: null }
            const purchase = await transaction(notification.data.signedTransactionInfo, [environment])
            if (notification.data.signedRenewalInfo)
                await verified(verifier(environment).verifyAndDecodeRenewalInfo(notification.data.signedRenewalInfo))
            return { id, environment, chain: purchase.originalTransactionId }
        },
    }
}
