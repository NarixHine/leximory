import 'server-only'
import { Lang } from '@/lib/config'
import { generateText } from 'ai'
import { getBestArticleAnnotationModel, noThinkingConfig } from './models'
import { instruction, accentPreferencePrompt } from '@/lib/prompt'

export const articleAnnotationPrompt = async (lang: Lang, input: string, onlyComments: boolean, userId: string, autoTrim: boolean = true) => ({
    system: `
        生成文本注解（形如 [[vocabulary]] 双重中括号内的词以及形如<must>vocabulary</must>的词必须注解，除此以外***尽可能多***地挑选。

        ${instruction[lang]}
            
        你将会看到一段网页文本，你${onlyComments ? '可以无视示例格式。禁止输出文本，直接制作词摘。你必须直接给出以{{}}包裹的注释部分，不加上下文。只输出{{}}内的内容（含{{}}，禁止省略双重大括号），输出形如“{{一个词汇的原形||原形||注解||……}} {{另一个词汇的原形||原形||注解||……}} ……”。不要注解术语，多多注解实用、通用语块，俗语、短语和动词搭配' : (autoTrim ? '首先要删去首尾的标题、作者、日期、导航和插入正文的广告等无关部分，段与段间空两行，并提取出其中的正文。' : '必须完整保留原文的内容和格式！包括必须完整保留所有Markdown语法，禁止删除Markdown语法的标题、引用或其他任何元素。极其小心、严格地按要求使用注释语法，谨防出现误用。')}
    `,
    prompt: `
    ${lang !== 'en' ? '' : '你要为英语学习者注解一切高阶或罕见词汇，必须添加语源。'}注解必须均匀地遍布下文。
    ${onlyComments ? '注意：禁止输出原文。请多注解有益于语言学习的语块而非术语，尽可能详尽丰富，不得少于二十个。多注解成块词组、短语（例如on the horns of a dilemma）、俗语（catch off guard），尤其是动词短语，越多越好。' : ''}
    ${await accentPreferencePrompt({ lang, userId })}
    
    ${input}`,
    maxTokens: 12000,
    ...noThinkingConfig
})

export const annotateParagraph = async ({ content, lang, userId, autoTrim = true }: { content: string, lang: Lang, userId: string, autoTrim?: boolean }) => {
    const { text } = await generateText({
        model: getBestArticleAnnotationModel(lang),
        ...(await articleAnnotationPrompt(lang, content, false, userId, autoTrim)),
    })
    return text
}
