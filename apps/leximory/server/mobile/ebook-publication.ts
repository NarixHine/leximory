import 'server-only'
import { randomUUID, createHash } from 'node:crypto'
import type { redis } from '@repo/kv/redis'
import { ebookSourceKey, ebookVersionPath, readEbookSource, type EbookSource } from './ebook-source'
import { mutationEffects } from './mutation-effects'
import { textMutationKey } from './mutation-lease'
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

export type EbookReplacement = { id: string; base: string | null }

export function createEbookPublication(
    database: Pick<typeof supabase, 'from' | 'storage'>,
    state: Pick<typeof redis, 'get' | 'eval'>,
) {
    const bucket = database.storage.from('user-files')
    const digest = async (file: Blob) =>
        createHash('sha256')
            .update(new Uint8Array(await file.arrayBuffer()))
            .digest('hex')

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
        async publish(text: TextRow, file: File, token: string, replacement?: EbookReplacement) {
            const previous = await readEbookSource(state, text.id)
            if (replacement && previous?.id === replacement.id) return previous
            if (replacement && (previous?.id ?? null) !== replacement.base) throw new MobileError('stale_revision')
            const version: Pick<EbookSource, 'id' | 'format'> = {
                id: replacement?.id ?? randomUUID(),
                format: file.type === 'application/pdf' ? 'pdf' : 'epub',
            }
            const path = ebookVersionPath(text.id, version)
            const uploaded = await bucket.upload(path, file, { contentType: file.type, cacheControl: '0' })
            if (uploaded.error) {
                const existing = await bucket.download(path)
                if (existing.error || (await digest(existing.data)) !== (await digest(file))) throw uploaded.error
            }
            const source = { ...version, publishedAt: nextTextTimestamp(previous?.publishedAt ?? null) }
            const accepted = await state.eval(
                `if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
                  local current = redis.call('GET', KEYS[2])
                  if (current and cjson.decode(current).id or '') ~= ARGV[2] then return -1 end
                  redis.call('SET', KEYS[2], ARGV[3])
                  return 1`,
                [textMutationKey(text.id), ebookSourceKey(text.id)],
                [token, previous?.id ?? '', JSON.stringify(source)],
            )
            if (accepted === -1) throw new MobileError('stale_revision')
            if (accepted !== 1) throw new MobileError('service_unavailable')
            if (previous)
                mutationEffects.schedule({
                    name: 'ebook.cleanup',
                    run: async () => {
                        const retired = await bucket.remove([ebookVersionPath(text.id, previous)])
                        if (retired.error) throw retired.error
                    },
                })
            return source
        },
        async update(text: TextRow, hasEbook: boolean) {
            const updatedAt = nextTextTimestamp(text.updated_at)
            if (!text.lib) throw new MobileError('inaccessible')
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
