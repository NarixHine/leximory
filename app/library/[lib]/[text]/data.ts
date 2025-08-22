import { authReadToText } from '@/server/auth/role'
import { getTextContent, getTextAnnotationProgress } from '@/server/db/text'
import { merge } from 'es-toolkit'

export const getArticleData = async (text: string, throwOnUnauthorized = true) => {
    if (throwOnUnauthorized) {
        await authReadToText(text)
    }
    const { title, content, topics, ebook, lib, prompt, isPublicAndFree } = await getTextContent({ id: text })
    const annotating = await getTextAnnotationProgress({ id: text })
    return merge({ title, content, topics, ebook, lib, annotating, prompt }, throwOnUnauthorized ? {} : { isPublicAndFree })
}
