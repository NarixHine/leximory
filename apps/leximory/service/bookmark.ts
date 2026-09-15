'use server'

import { Kilpi } from '@repo/service/kilpi'
import { getUserOrThrow } from '@repo/user'
import { getTextWithLib } from '@/server/db/text'
import { createBookmark, deleteBookmark, getBookmarkText } from '@/server/db/bookmark'
import { saveLocation } from '@/server/db/visited'

/** Any user who can read a text may keep their own private bookmarks on it. */
async function authorizeReading(textId: string) {
    const text = await getTextWithLib(textId)
    await Kilpi.texts.read(text).authorize().assert()
}

/** Saves a private bookmark for the current user. */
export async function saveBookmarkAction({
    textId,
    quote,
    chapter,
    location,
}: {
    textId: string
    quote: string
    chapter: string | null
    location: string | null
}) {
    const { userId } = await getUserOrThrow()
    await authorizeReading(textId)
    return createBookmark({ textId, userId, quote, chapter, location })
}

/** Deletes one of the current user's bookmarks. */
export async function removeBookmarkAction(id: number) {
    const { userId } = await getUserOrThrow()
    const textId = await getBookmarkText({ id, userId })
    if (!textId) return
    await authorizeReading(textId)
    await deleteBookmark({ id, userId })
}

/** Persists the current user's reading position for a text. */
export async function saveLocationAction({
    textId,
    location,
}: {
    textId: string
    location: string
}) {
    const { userId } = await getUserOrThrow()
    await authorizeReading(textId)
    await saveLocation({ textId, userId, location })
}
