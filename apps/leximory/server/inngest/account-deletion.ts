import { inngest } from './client'
import { accountDeletionRequested } from './events'
import {
    accountDeletionLedger as ledger,
    accountDeletionPersistence as persistence,
} from '../mobile/account-deletion-store'
import { invalidateMutationCaches } from '../mobile/mutation-effects'

export const deleteAccount = inngest.createFunction(
    {
        id: 'delete-account',
        retries: 8,
        concurrency: { limit: 1, key: 'event.data.requestId' },
        triggers: [accountDeletionRequested],
        onFailure: async ({ event }) => {
            const record = await ledger.read(event.data.event.data.requestId)
            if (record && record.status !== 'completed') await ledger.status(record, 'failed')
        },
    },
    async ({ event, step }) => {
        const record = await ledger.read(event.data.requestId)
        if (!record || record.status === 'completed') return { completed: true }
        await ledger.status(record, 'pending')
        await step.run('freeze-account', () => persistence.freeze(record.userId, record.requestId))
        // Let already accepted bounded HTTP operations finish before taking the ownership inventory.
        await step.sleep('drain-active-requests', '2m')
        const manifest = await step.run('inventory-owned-data', async () => {
            const previous = await ledger.manifest(record.requestId)
            if (previous) return previous
            const manifest = await persistence.inventory(record.userId)
            await ledger.saveManifest(record.requestId, manifest)
            return manifest
        })
        await step.run('remove-files', () => persistence.files(manifest, record.userId))
        await step.run('remove-database-records', () => persistence.records(manifest, record.userId))
        await step.run('remove-unreferenced-audio', () => persistence.audio(manifest))
        await step.run('remove-service-state', () => ledger.purge(record.userId, manifest))
        await step.run('remove-auth', () => persistence.auth(record.userId))
        await step.run('confirm-deletion', async () => {
            await ledger.status(record, 'completed')
            invalidateMutationCaches(`profile:${record.userId}`)
            invalidateMutationCaches('libraries')
            invalidateMutationCaches('words')
            for (const id of manifest.libraries) {
                invalidateMutationCaches(`texts:${id}`)
                invalidateMutationCaches(`words:${id}`)
            }
        })
        return { completed: true }
    },
)
