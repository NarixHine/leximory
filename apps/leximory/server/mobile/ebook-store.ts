import 'server-only'
import { z } from 'zod'
import { checkedResponse } from './http'
import { supabase } from '@repo/supabase'
import { getBookmarks, createBookmark, getBookmarkText, deleteBookmark } from '@/server/db/bookmark'
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
                url.searchParams.set(
                    'v',
                    checkedResponse(z.object({ version: z.string().min(1).max(256) }), metadata.data).version,
                )
                return { url: url.href, format }
            }
        }
        return null
    },
    location: (textId, userId) => getLocation({ textId, userId }),
    bookmarks: (textId, userId) => getBookmarks({ textId, userId }),
    savePosition: (textId, userId, location) => saveLocation({ textId, userId, location }),
    saveBookmark: createBookmark,
    async removeBookmark({ textId, userId, bookmarkId }) {
        if ((await getBookmarkText({ id: bookmarkId, userId })) !== textId) throw new MobileError('inaccessible')
        await deleteBookmark({ id: bookmarkId, userId })
    },
}
