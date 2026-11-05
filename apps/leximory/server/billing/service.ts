import { z } from 'zod'
import {
    appleRenewal,
    appleTransaction,
    appleEvidenceSnapshot,
    storedClaims,
    type AppleEnvironment,
    type AppleSnapshot,
} from '@repo/user/entitlements'

export class AppleBillingError extends Error {
    constructor(readonly reason: 'invalid' | 'owner' | 'unavailable') {
        super(`Apple billing: ${reason}`)
    }
}
export interface AppleGateway {
    transaction(jws: string, environments: AppleEnvironment[]): Promise<z.infer<typeof appleTransaction>>
    latest(
        environment: AppleEnvironment,
        chain: string,
    ): Promise<Omit<z.infer<typeof appleEvidenceSnapshot>, 'version' | 'verified_at'>>
}
export interface AppleRepository {
    read(environment: AppleEnvironment, chain: string): Promise<AppleSnapshot | null>
    // A conditional insert/update must preserve the existing owner and version.
    commit(previous: AppleSnapshot | null, snapshot: AppleSnapshot): Promise<boolean>
}
export function createAppleBilling({
    gateway,
    repository,
    sandboxAllowed,
    now = () => Date.now(),
}: {
    gateway: AppleGateway
    repository: AppleRepository
    sandboxAllowed(userId: string): boolean
    now?: () => number
}) {
    async function reconcile(
        environment: AppleEnvironment,
        chain: string,
        expectedOwner?: string,
        signal?: AbortSignal,
        submitted?: z.infer<typeof appleTransaction>,
    ) {
        for (let attempt = 0; attempt < 4; attempt++) {
            signal?.throwIfAborted()
            const previous = await repository.read(environment, chain)
            if (previous && (previous.user_id === null || (expectedOwner && previous.user_id !== expectedOwner)))
                throw new AppleBillingError('owner')
            // Read the version before the network request so older concurrent fetches cannot overwrite a newer commit.
            const latest = await gateway.latest(environment, chain)
            signal?.throwIfAborted()
            if (submitted) {
                const current = storedClaims(appleTransaction, latest.signed_transaction_info)
                if (
                    current.purchaseDate < submitted.purchaseDate ||
                    (current.purchaseDate === submitted.purchaseDate &&
                        current.transactionId !== submitted.transactionId) ||
                    (submitted.revocationDate !== undefined &&
                        current.revocationDate === undefined &&
                        current.transactionId === submitted.transactionId)
                ) {
                    throw new AppleBillingError('unavailable')
                }
            }
            if (
                !latest.user_id ||
                (expectedOwner && latest.user_id !== expectedOwner) ||
                (previous && previous.user_id !== latest.user_id)
            )
                throw new AppleBillingError('owner')
            if (environment === 'Sandbox' && !sandboxAllowed(latest.user_id)) throw new AppleBillingError('owner')
            let renewalEvidence = latest.signed_renewal_info
            if (previous) {
                const oldTransaction = storedClaims(appleTransaction, previous.signed_transaction_info)
                const oldRenewal = storedClaims(appleRenewal, previous.signed_renewal_info)
                const transaction = storedClaims(appleTransaction, latest.signed_transaction_info)
                const renewal = storedClaims(appleRenewal, latest.signed_renewal_info)
                const transactionOrder =
                    transaction.purchaseDate - oldTransaction.purchaseDate ||
                    transaction.signedDate - oldTransaction.signedDate
                if (transactionOrder < 0) return previous
                if (renewal.signedDate < oldRenewal.signedDate) {
                    if (transactionOrder === 0) return previous
                    // Transaction and renewal JWS have independent clocks. Keep a newer cancellation
                    // decision without discarding a new period or refund from Apple's current status.
                    renewalEvidence = previous.signed_renewal_info
                }
            }
            const snapshot: AppleSnapshot = {
                ...latest,
                signed_renewal_info: renewalEvidence,
                version: (previous?.version ?? 0) + 1,
                verified_at: new Date(now()).toISOString(),
            }
            if (await repository.commit(previous, snapshot)) return snapshot
        }
        throw new AppleBillingError('unavailable')
    }
    return {
        reconcile,
        async deliver(userId: string, jws: string, signal?: AbortSignal) {
            const environments: AppleEnvironment[] = sandboxAllowed(userId) ? ['Production', 'Sandbox'] : ['Production']
            const transaction = await gateway.transaction(jws, environments)
            if (transaction.appAccountToken.toLowerCase() !== userId.toLowerCase()) throw new AppleBillingError('owner')
            await reconcile(transaction.environment, transaction.originalTransactionId, userId, signal, transaction)
            return { acknowledgedTransactionId: transaction.transactionId }
        },
    }
}
