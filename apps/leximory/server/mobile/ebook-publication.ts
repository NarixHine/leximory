import 'server-only'
import { PostgrestError } from '@supabase/supabase-js'
import { z } from 'zod'
import type { supabase } from '@repo/supabase'
import type { TextRow } from './catalog'
import { EbookPublicationUnconfirmed } from './ebook-file-change'
import { MobileError } from './errors'
import { checkedResponse } from './http'
import { nextTextTimestamp } from './text-edit-store'

const publicationSchema = z.object({
    lib: z.string().nullable(),
    has_ebook: z.boolean(),
    updated_at: z.string().nullable(),
})

export function createEbookPublication(database: Pick<typeof supabase, 'from'>) {
    async function read(id: string) {
        const { data } = await database
            .from('texts')
            .select('lib,has_ebook,updated_at')
            .eq('id', id)
            .maybeSingle()
            .throwOnError()
        return checkedResponse(publicationSchema.nullable(), data)
    }

    async function commit(write: () => Promise<void>, confirmed: () => Promise<boolean>) {
        try {
            await write()
        } catch (error) {
            if (error instanceof MobileError || (error instanceof PostgrestError && error.code)) throw error
            try {
                if (await confirmed()) return
                // A repeat is conditional on the same revision, so at most one update can take effect.
                await write()
            } catch (recoveryError) {
                if (await confirmed().catch(() => false)) return
                throw new EbookPublicationUnconfirmed(
                    new AggregateError([error, recoveryError], 'Ebook publication could not be confirmed', {
                        cause: error,
                    }),
                )
            }
        }
    }

    return {
        async update(text: TextRow, hasEbook: boolean) {
            if (!text.lib) throw new MobileError('inaccessible')
            const updatedAt = nextTextTimestamp(text.updated_at)
            let update = database
                .from('texts')
                .update({ has_ebook: hasEbook, updated_at: updatedAt })
                .eq('id', text.id)
                .eq('lib', text.lib)
                .is('bookmark_url', null)
                .eq('has_ebook', text.has_ebook)
            update = text.updated_at === null ? update.is('updated_at', null) : update.eq('updated_at', text.updated_at)
            await commit(
                async () => {
                    const { data } = await update.select('id').maybeSingle().throwOnError()
                    if (!data) throw new MobileError('stale_revision')
                },
                async () => {
                    const current = await read(text.id)
                    return (
                        current?.lib === text.lib &&
                        current.has_ebook === hasEbook &&
                        current.updated_at !== null &&
                        Date.parse(current.updated_at) === Date.parse(updatedAt)
                    )
                },
            )
        },
        async remove(text: TextRow) {
            if (!text.lib) throw new MobileError('inaccessible')
            const libraryId = text.lib
            await commit(
                async () => {
                    const { data } = await database
                        .from('texts')
                        .delete()
                        .eq('id', text.id)
                        .eq('lib', libraryId)
                        .is('bookmark_url', null)
                        .select('id')
                        .maybeSingle()
                        .throwOnError()
                    if (!data && (await read(text.id)) !== null) throw new MobileError('stale_revision')
                },
                async () => (await read(text.id)) === null,
            )
        },
    }
}
