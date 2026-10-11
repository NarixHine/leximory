import 'server-only'
import { supabase } from '@repo/supabase'
import { getBookmarks, createBookmark, getBookmarkText, deleteBookmark } from '@/server/db/bookmark'
import { MobileError } from './errors'
import { getLocation, saveLocation } from '@/server/db/visited'
import type { EbookStore } from './ebooks'

export const ebookStore: EbookStore = {
    async asset(id, signal) {
        for (const format of ['pdf', 'epub'] satisfies ('pdf' | 'epub')[]) {
            signal.throwIfAborted()
            const { data, error } = await supabase.storage.from('user-files').createSignedUrl(`ebooks/${id}.${format}`, 3600)
            signal.throwIfAborted()
            if (!error && data) return { url: data.signedUrl, format }
        }
        return null
    },
    location: (textId, userId) => getLocation({ textId, userId }),
    bookmarks: (textId, userId) => getBookmarks({ textId, userId }),
    savePosition: (textId, userId, location) => saveLocation({ textId, userId, location }),
    saveBookmark: createBookmark,
    async removeBookmark({ textId, userId, bookmarkId }) {
        if (await getBookmarkText({ id: bookmarkId, userId }) !== textId) throw new MobileError('inaccessible')
        await deleteBookmark({ id: bookmarkId, userId })
    },
}
