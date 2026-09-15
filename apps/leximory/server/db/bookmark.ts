import 'server-only'
import { supabase } from '@repo/supabase'
import { EbookBookmark } from '@/lib/types'

/** Returns the current user's bookmarks for a text, oldest first. */
export async function getBookmarks({
    textId,
    userId,
}: {
    textId: string
    userId: string
}): Promise<EbookBookmark[]> {
    const { data } = await supabase
        .from('bookmarks')
        .select('id, quote, chapter, location, created_at')
        .eq('text', textId)
        .eq('uid', userId)
        .order('created_at', { ascending: true })
        .throwOnError()

    return (data ?? []).map(({ id, quote, chapter, location, created_at }) => ({
        id,
        quote,
        chapter,
        location,
        createdAt: created_at,
    }))
}

/** Inserts a bookmark owned by the current user. */
export async function createBookmark({
    textId,
    userId,
    quote,
    chapter,
    location,
}: {
    textId: string
    userId: string
    quote: string
    chapter: string | null
    location: string | null
}): Promise<EbookBookmark> {
    const { data } = await supabase
        .from('bookmarks')
        .insert({
            text: textId,
            uid: userId,
            quote,
            chapter,
            location,
            created_at: new Date().toISOString(),
        })
        .select('id, quote, chapter, location, created_at')
        .single()
        .throwOnError()

    return {
        id: data.id,
        quote: data.quote,
        chapter: data.chapter,
        location: data.location,
        createdAt: data.created_at,
    }
}

/** Returns the text a bookmark belongs to, scoped to its owner. */
export async function getBookmarkText({ id, userId }: { id: number; userId: string }) {
    const { data } = await supabase
        .from('bookmarks')
        .select('text')
        .eq('id', id)
        .eq('uid', userId)
        .maybeSingle()

    return data?.text ?? null
}

/** Deletes a bookmark, scoped to its owner. */
export async function deleteBookmark({ id, userId }: { id: number; userId: string }) {
    await supabase.from('bookmarks').delete().eq('id', id).eq('uid', userId).throwOnError()
}
