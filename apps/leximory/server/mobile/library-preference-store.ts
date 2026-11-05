import 'server-only'
import type { supabase } from '@repo/supabase'
import { z } from 'zod'
import { MobileError } from './errors'
import { checkedResponse } from './http'

const archiveState = z.object({ archived_libs: z.array(z.string()).nullable() }).nullable()

export function createLibraryPreferenceStore(database: Pick<typeof supabase, 'from'>) {
    async function read(userId: string, signal: AbortSignal) {
        const { data } = await database
            .from('users')
            .select('archived_libs')
            .eq('id', userId)
            .abortSignal(signal)
            .maybeSingle()
            .throwOnError()
        return checkedResponse(archiveState, data)
    }

    return {
        async archived(userId: string, signal: AbortSignal): Promise<string[]> {
            return (await read(userId, signal))?.archived_libs ?? []
        },
        async setArchived(userId: string, libraryId: string, archived: boolean, signal: AbortSignal) {
            for (let attempt = 0; attempt < 3; attempt++) {
                signal.throwIfAborted()
                const user = await read(userId, signal)
                if (!user) {
                    // Match web account initialization without resetting an existing account's balance or plan.
                    await database
                        .from('users')
                        .upsert({ id: userId, lexicoin: 20 }, { onConflict: 'id', ignoreDuplicates: true })
                        .abortSignal(signal)
                        .throwOnError()
                    continue
                }
                const current = user.archived_libs
                const ids = current ?? []
                if (ids.includes(libraryId) === archived) return
                const updated = archived ? [...ids, libraryId] : ids.filter((id) => id !== libraryId)
                let query = database.from('users').update({ archived_libs: updated }).eq('id', userId)
                query =
                    current === null
                        ? query.is('archived_libs', null)
                        : query.filter('archived_libs', 'eq', `{${current.map((id) => JSON.stringify(id)).join(',')}}`)
                const { data } = await query.select('id').abortSignal(signal).throwOnError()
                const saved = checkedResponse(z.array(z.object({ id: z.literal(userId) })), data)
                if (saved.length) return
            }
            // The final competing write may already have committed the requested state.
            const user = await read(userId, signal)
            if (user && (user.archived_libs ?? []).includes(libraryId) === archived) return
            throw new MobileError('service_unavailable')
        },
    }
}
