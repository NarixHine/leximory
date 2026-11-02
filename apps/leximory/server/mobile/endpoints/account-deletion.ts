import 'server-only'
import { mobileEndpoint } from '../http'
import { verify } from './verify'
import { createAccountDeletionOperations, createAccountDeletionReceiptEndpoint } from '../account-deletion'
import { accountDeletionStore } from '../account-deletion-store'

export const accountDeletion = mobileEndpoint(
    verify,
    createAccountDeletionOperations(accountDeletionStore).accountDeletion,
    60000,
)
export const accountDeletionStatus = createAccountDeletionReceiptEndpoint(accountDeletionStore, false)
export const accountDeletionRetry = createAccountDeletionReceiptEndpoint(accountDeletionStore, true)
