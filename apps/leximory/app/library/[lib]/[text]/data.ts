import { Kilpi } from '@repo/service/kilpi'
import { getTextContent, getTextAnnotationProgress, getTextWithLib } from '@/server/db/text'

export const getArticleData = async (text: string, throwOnUnauthorized = true) => {
    if (throwOnUnauthorized) {
        const textWithLib = await getTextWithLib(text)
        await Kilpi.texts.read(textWithLib).authorize().assert()
    }
    const [
        { title, content, topics, ebook, emoji, createdAt, lib, prompt, isPublicAndFree },
        annotating
    ] = await Promise.all([
        getTextContent({ id: text }),
        getTextAnnotationProgress({ id: text })
    ])
    return { title, content, topics, ebook, emoji, createdAt, lib, annotating, prompt, isPublicAndFree }
}
