import { Lang } from '@/lib/config'
import { articleAnnotationPrompt } from '@/server/inngest/annotate'
import { generateText } from 'ai'
import { getBestArticleAnnotationModel } from './models'

export const annotateParagraph = async ({ content, lang, userId, autoTrim = true }: { content: string, lang: Lang, userId: string, autoTrim?: boolean }) => {
    const { text } = await generateText({
        model: getBestArticleAnnotationModel(lang),
        ...(await articleAnnotationPrompt(lang, content, false, userId, autoTrim)),
    })
    return text
}
