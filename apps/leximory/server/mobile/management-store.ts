import 'server-only'
import { z } from 'zod'
import { checkedResponse } from './http'
import { randomUUID } from 'node:crypto'
import type { redis } from '@repo/kv/redis'
import { changeEbookFile } from './ebook-file-change'
import { ebookFiles } from './ebook-storage'
import type { supabase } from '@repo/supabase'
import { invalidateMutationCaches, mutationEffects } from './mutation-effects'
import { editTextRecord } from './text-edit-store'
import { MobileError } from './errors'
import type { ManagementStore } from './management'

function expireText(library: string) {
    invalidateMutationCaches(`texts:${library}`)
}
export function createManagementStore({
    database,
    lease,
}: {
    database: Pick<typeof supabase, 'from' | 'storage'>
    lease: Pick<typeof redis, 'set' | 'eval'>
}): ManagementStore {
    async function publishEbook(id: string, publish: () => Promise<void>) {
        const locations = z.array(z.object({ id: z.number().int(), location: z.string() }))
        const snapshots = []
        for (const table of ['reads', 'bookmarks'] as const) {
            const rows: z.infer<typeof locations> = []
            let after = 0
            while (true) {
                const { data } = await database
                    .from(table)
                    .select('id,location')
                    .eq('text', id)
                    .not('location', 'is', null)
                    .gt('id', after)
                    .order('id')
                    .limit(1000)
                    .throwOnError()
                const page = checkedResponse(locations, data)
                rows.push(...page)
                if (page.length < 1000) break
                after = page[page.length - 1]!.id
            }
            snapshots.push({ table, rows })
        }
        try {
            for (const { table, rows } of snapshots) {
                // Clear only snapshotted rows so rollback has every original location.
                for (let offset = 0; offset < rows.length; offset += 100) {
                    await database
                        .from(table)
                        .update({ location: null })
                        .eq('text', id)
                        .in(
                            'id',
                            rows.slice(offset, offset + 100).map((row) => row.id),
                        )
                        .throwOnError()
                }
            }
            await publish()
        } catch (error) {
            const restored = await Promise.allSettled(
                snapshots.flatMap(({ table, rows }) =>
                    rows.map(async (row) => {
                        // Do not overwrite a position saved by a reader during recovery.
                        await database
                            .from(table)
                            .update({ location: row.location })
                            .eq('text', id)
                            .eq('id', row.id)
                            .is('location', null)
                            .throwOnError()
                    }),
                ),
            )
            const failures = restored.flatMap((result) => (result.status === 'rejected' ? [result.reason] : []))
            if (failures.length)
                throw new AggregateError([error, ...failures], 'Ebook location rollback failed', { cause: error })
            throw error
        }
    }
    async function withTextMutation<T>(id: string, operation: () => Promise<T>): Promise<T> {
        const key = `mobile:text-mutation:${id}`
        const token = randomUUID()
        if (!(await lease.set(key, token, { nx: true, ex: 120 }))) throw new MobileError('service_unavailable')
        try {
            return await operation()
        } finally {
            await mutationEffects.run({
                name: 'lease.release',
                run: async () => {
                    await lease.eval(
                        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) end return 0",
                        [key],
                        [token],
                    )
                },
            })
        }
    }
    const operations: ManagementStore = {
        async edit(text, fields) {
            const updated = await editTextRecord({ database: database, text, fields })
            expireText(text.lib!)
            return updated
        },
        async remove(text) {
            const removeRecord = async () => {
                await database
                    .from('texts')
                    .delete()
                    .eq('id', text.id)
                    .eq('lib', text.lib!)
                    .is('bookmark_url', null)
                    .throwOnError()
            }
            if (text.has_ebook) await changeEbookFile(ebookFiles(database, text.id), null, removeRecord)
            else await removeRecord()
            expireText(text.lib!)
        },
        async replaceEbook(text, file) {
            await changeEbookFile(
                ebookFiles(database, text.id),
                { extension: file.type === 'application/pdf' ? 'pdf' : 'epub', file },
                () =>
                    publishEbook(text.id, async () => {
                        await database
                            .from('texts')
                            .update({ has_ebook: true })
                            .eq('id', text.id)
                            .eq('lib', text.lib!)
                            .is('bookmark_url', null)
                            .select('id')
                            .single()
                            .throwOnError()
                    }),
            )
            expireText(text.lib!)
        },
        async removeEbook(text) {
            await changeEbookFile(ebookFiles(database, text.id), null, () =>
                publishEbook(text.id, async () => {
                    await database
                        .from('texts')
                        .update({ has_ebook: false })
                        .eq('id', text.id)
                        .eq('lib', text.lib!)
                        .is('bookmark_url', null)
                        .select('id')
                        .single()
                        .throwOnError()
                }),
            )
            expireText(text.lib!)
        },
        async removeWord(id, library) {
            await database.from('lexicon').delete().eq('id', id).eq('lib', library).throwOnError()
            invalidateMutationCaches(`words:${library}`)
            invalidateMutationCaches('words')
            invalidateMutationCaches(id)
        },
    }
    return {
        edit: (text, fields) => withTextMutation(text.id, () => operations.edit(text, fields)),
        remove: (text) => withTextMutation(text.id, () => operations.remove(text)),
        replaceEbook: (text, file) => withTextMutation(text.id, () => operations.replaceEbook(text, file)),
        removeEbook: (text) => withTextMutation(text.id, () => operations.removeEbook(text)),
        removeWord: operations.removeWord,
    }
}
