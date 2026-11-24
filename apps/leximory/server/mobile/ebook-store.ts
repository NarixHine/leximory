import 'server-only'
import { redis } from '@repo/kv/redis'
import { readEbookSource, ebookSourceCandidates } from './ebook-source'
import { readPDFOutlinePointer } from './pdf-outline-storage'
import { z } from 'zod'
import { checkedResponse } from './http'
import { supabase } from '@repo/supabase'
import { getBookmarks, createBookmark, getBookmarkText, deleteBookmark } from '@/server/db/bookmark'
import { ebookHighlightColorSchema } from '@repo/api'
import { MobileError } from './errors'
import { getLocation, saveLocation } from '@/server/db/visited'
import type { EbookStore } from './ebooks'

export const ebookStore: EbookStore = {
    async asset(id, signal) {
        const source = await readEbookSource(redis, id)
        const bucket = supabase.storage.from('user-files')
        for (const { format, path } of ebookSourceCandidates(id, source)) {
            signal.throwIfAborted()
            const [{ data, error }, metadata] = await Promise.all([
                bucket.createSignedUrl(path, 3600),
                bucket.info(path),
            ])
            signal.throwIfAborted()
            if (!error && data) {
                if (metadata.error) throw metadata.error
                const url = new URL(data.signedUrl)
                const sourceVersion = checkedResponse(
                    z.object({ version: z.string().min(1).max(256) }),
                    metadata.data,
                ).version
                if (format === 'pdf') {
                    const outline = await readPDFOutlinePointer(id, sourceVersion)
                    if (outline) {
                        const signed = await bucket.createSignedUrl(outline.path, 3600)
                        if (signed.error) throw signed.error
                        const outlinedURL = new URL(signed.data.signedUrl)
                        outlinedURL.searchParams.set('v', sourceVersion + ':' + outline.revision)
                        return {
                            url: outlinedURL.href,
                            format,
                            sourceVersion,
                            outlineRevision: outline.revision,
                            publishedAt: source?.publishedAt,
                        }
                    }
                }
                url.searchParams.set('v', sourceVersion)
                return { url: url.href, format, sourceVersion, publishedAt: source?.publishedAt }
            }
        }
        return null
    },
    location: (textId, userId, since) => getLocation({ textId, userId, since }),
    bookmarks: (textId, userId, since) => getBookmarks({ textId, userId, since }),
    savePosition: (textId, userId, location) => saveLocation({ textId, userId, location }),
    async saveBookmark(input) {
        if (input.bookmarkId === undefined) return createBookmark(input)
        const { data } = await supabase
            .from('bookmarks')
            .update({ color: input.color })
            .eq('id', input.bookmarkId)
            .eq('text', input.textId)
            .eq('uid', input.userId)
            .select('id, quote, chapter, location, created_at, color')
            .maybeSingle()
            .throwOnError()
        if (!data) throw new MobileError('inaccessible')
        const source = await readEbookSource(redis, input.textId)
        const fromCurrentEdition = !source || Date.parse(data.created_at) > Date.parse(source.publishedAt)
        return {
            id: data.id,
            quote: data.quote,
            chapter: data.chapter,
            location: fromCurrentEdition ? data.location : null,
            createdAt: data.created_at,
            color: ebookHighlightColorSchema.parse(data.color),
        }
    },
    async removeBookmark({ textId, userId, bookmarkId }) {
        if ((await getBookmarkText({ id: bookmarkId, userId })) !== textId) throw new MobileError('inaccessible')
        await deleteBookmark({ id: bookmarkId, userId })
    },
}
