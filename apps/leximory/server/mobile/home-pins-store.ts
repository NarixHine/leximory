import 'server-only'
import type { supabase } from '@repo/supabase'
import type { Database } from '@repo/supabase/types'
import { homePinSchema } from '@repo/api'
import { checkedResponse } from './http'
import type { HomePin, HomePinsStore } from './home-pins'

type Row = Database['public']['Tables']['browser_home_pins']['Row']
function pin(row: Row): HomePin {
    return checkedResponse(homePinSchema, {
        id: row.id,
        title: row.title,
        destination: row.destination,
        faviconURL: row.favicon_url,
        sortOrder: row.sort_order,
        revision: row.revision,
        deletedAt: row.deleted_at,
        updatedAt: row.updated_at,
    })
}

export function createHomePinsStore(database: Pick<typeof supabase, 'from'>): HomePinsStore {
    const scoped = (userId: string) => database.from('browser_home_pins').select('*').eq('user_id', userId)
    return {
        async list(userId, cursor, signal) {
            const query = scoped(userId).order('id').limit(101)
            if (cursor) query.gt('id', cursor)
            const { data } = await query.abortSignal(signal).throwOnError()
            const items = data.slice(0, 100).map(pin)
            return { items, nextCursor: data.length > 100 ? (items.at(-1)?.id ?? null) : null }
        },
        async save(userId, pinId, input, signal) {
            const now = new Date().toISOString()
            const values = {
                title: input.title,
                destination: input.destination,
                favicon_url: input.faviconURL,
                sort_order: input.sortOrder,
                revision: input.revision,
                deleted_at: input.deleted ? now : null,
                updated_at: now,
            }
            if (input.expectedRevision === null) {
                const { data, error } = await database
                    .from('browser_home_pins')
                    .insert({ ...values, user_id: userId, id: pinId })
                    .select('*')
                    .abortSignal(signal)
                    .maybeSingle()
                if (error && error.code !== '23505') throw error
                if (data) return pin(data)
            } else {
                const { data } = await database
                    .from('browser_home_pins')
                    .update(values)
                    .eq('user_id', userId)
                    .eq('id', pinId)
                    .eq('revision', input.expectedRevision)
                    .is('deleted_at', null)
                    .select('*')
                    .abortSignal(signal)
                    .maybeSingle()
                    .throwOnError()
                if (data) return pin(data)
            }
            // A replay or CAS loser receives the committed row, including an irreversible tombstone.
            const { data } = await scoped(userId).eq('id', pinId).abortSignal(signal).maybeSingle().throwOnError()
            return data ? pin(data) : null
        },
    }
}
