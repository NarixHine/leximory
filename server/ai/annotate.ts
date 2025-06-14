import { getBestArticleAnnotationModel, Lang } from '@/lib/config'
import { articleAnnotationPrompt } from '@/server/inngest/annotate'
import { generateText } from 'ai'

export const annotateParagraph = async ({ content, lang, userId }: { content: string, lang: Lang, userId: string }) => {
    const { text } = await generateText({
        model: getBestArticleAnnotationModel(lang),
        ...(await articleAnnotationPrompt(lang, content, false, userId)),
    })
    return text
}
