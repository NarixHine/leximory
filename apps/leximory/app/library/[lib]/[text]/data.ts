import { Kilpi } from '@repo/service/kilpi'
import { getUser } from '@repo/user'
import { getTextContent, getTextAnnotationProgress, getTextWithLib } from '@/server/db/text'
import { getBookmarks } from '@/server/db/bookmark'
import { getLocation } from '@/server/db/visited'

export const getArticleData = async (text: string, throwOnUnauthorized = true) => {
    if (throwOnUnauthorized) {
        const textWithLib = await getTextWithLib(text)
        await Kilpi.texts.read(textWithLib).authorize().assert()
    }
    const user = await getUser()
    const [
        { title, content, topics, ebook, emoji, createdAt, lib, prompt, isPublicAndFree },
        annotating,
        bookmarks,
        location,
    ] = await Promise.all([
        getTextContent({ id: text }),
        getTextAnnotationProgress({ id: text }),
        user ? getBookmarks({ textId: text, userId: user.userId }) : Promise.resolve([]),
        user ? getLocation({ textId: text, userId: user.userId }) : Promise.resolve(null),
    ])
    return {
        title,
        content,
        topics,
        ebook,
        emoji,
        createdAt,
        lib,
        annotating,
        prompt,
        isPublicAndFree,
        bookmarks,
        location,
    }
}
