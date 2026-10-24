import 'server-only'
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
        for (const format of ['pdf', 'epub'] satisfies ('pdf' | 'epub')[]) {
            signal.throwIfAborted()
            const bucket = supabase.storage.from('user-files')
            const path = `ebooks/${id}.${format}`
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
                url.searchParams.set('v', sourceVersion)
                return { url: url.href, format, sourceVersion }
            }
        }
        return null
    },
    location: (textId, userId) => getLocation({ textId, userId }),
    bookmarks: (textId, userId) => getBookmarks({ textId, userId }),
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
        return {
            id: data.id,
            quote: data.quote,
            chapter: data.chapter,
            location: data.location,
            createdAt: data.created_at,
            color: ebookHighlightColorSchema.parse(data.color),
        }
    },
    async removeBookmark({ textId, userId, bookmarkId }) {
        if ((await getBookmarkText({ id: bookmarkId, userId })) !== textId) throw new MobileError('inaccessible')
        await deleteBookmark({ id: bookmarkId, userId })
    },
}
