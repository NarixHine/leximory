import 'server-only'
import { Lang } from '@repo/env/config'
import { generateText } from 'ai'
import getLanguageServerStrategy from '@/lib/languages/strategies.server'
import { annotationPrompt } from './annotation-prompt'
import { miniAI } from './config'

export const articleAnnotationPrompt = async (
    lang: Lang,
    input: string,
    onlyComments: boolean,
    userId: string,
    autoTrim: boolean = true,
) => ({
    ...annotationPrompt({
        lang,
        input,
        onlyComments,
        autoTrim,
        accentPrompt: await getLanguageServerStrategy(lang).getAccentPrompt(userId),
    }),
    ...miniAI,
})

export const annotateParagraph = async ({
    content,
    lang,
    userId,
    autoTrim = true,
}: {
    content: string
    lang: Lang
    userId: string
    autoTrim?: boolean
}) => {
    const { text } = await generateText(await articleAnnotationPrompt(lang, content, false, userId, autoTrim))
    return text
}
