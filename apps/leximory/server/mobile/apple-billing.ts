import { z } from 'zod'
import { appleTransactionInput, appleTransactionResult } from '@repo/api'
import { AppleBillingError } from '../billing/service'
import { checkedResponse, jsonBody, query, type MobileOperation } from './http'
import { MobileError } from './errors'

export function createAppleBillingOperations(store: {
    deliver(userId: string, signedTransaction: string, signal: AbortSignal): Promise<unknown>
}) {
    return {
        appleTransaction: async ({ request, subject, signal }) => {
            query(request, [])
            const { signedTransaction } = appleTransactionInput.parse(await jsonBody(request, 33000, signal))
            try {
                return checkedResponse(
                    appleTransactionResult,
                    await store.deliver(subject.userId, signedTransaction, signal),
                )
            } catch (error) {
                if (error instanceof z.ZodError) throw new MobileError('service_unavailable')
                if (error instanceof AppleBillingError) {
                    if (error.reason === 'owner') throw new MobileError('purchase_account_mismatch')
                    if (error.reason === 'invalid') throw new MobileError('invalid_input')
                }
                throw error
            }
        },
    } satisfies Record<string, MobileOperation>
}
