import 'server-only'
import { randomUUID } from 'node:crypto'
import { supabase } from '@repo/supabase'
import { redis } from '@repo/kv/redis'
import { publishEvent } from '../inngest/client'
import { accountDeletionRequested } from '../inngest/events'
import { createAccountDeletionLedger } from './account-deletion-ledger'
import { createAccountDeletionPersistence } from './account-deletion-persistence'
import type { AccountDeletionStore } from './account-deletion'

export const accountDeletionLedger = createAccountDeletionLedger(redis)
export const accountDeletionPersistence = createAccountDeletionPersistence(supabase)
export const accountDeletionStore: AccountDeletionStore = {
    begin: accountDeletionLedger.begin,
    read: accountDeletionLedger.read,
    freeze: (record) => accountDeletionPersistence.freeze(record.userId, record.requestId),
    async enqueue(record) {
        await accountDeletionLedger.status(record, 'pending')
        await publishEvent(
            accountDeletionRequested.create(
                { requestId: record.requestId },
                {
                    id: `account-deletion:${record.requestId}:${randomUUID()}`,
                },
            ),
        )
    },
}
