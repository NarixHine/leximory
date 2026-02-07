import { SECTION_NAME_MAP } from '@repo/env/config'
import { QuizData } from '@repo/schema/paper'

/**
 * Strips HTML tags from a string.
 */
export function stripHtmlTags(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Extracts text content from quiz data.
 */
export function extractTextFromQuizData(data: QuizData): string {
    switch (data.type) {
        case 'grammar':
        case 'fishing':
        case 'sentences':
        case 'cloze':
            return stripHtmlTags(data.text)
        case 'reading':
            return stripHtmlTags(data.text)
        case 'listening':
            return data.questions.map(q => stripHtmlTags(q.transcript)).join('\n\n')
        case 'custom':
            return stripHtmlTags(data.paper)
        default:
            return ''
    }
}

export const buildChunkGenerationSystemPrompt = () => `
<instructions>
你是一位专业的英语教育专家，专门帮助中国高中生学习地道的英语表达。
你的任务是从给定的英语文本中提取有价值的表达片段（chunks），并提供准确且**地道自然**的中文翻译，而非生硬的翻译腔。

提取原则：
1. 每个chunk应该是一个完整的表达单位，可以独立使用
2. 优先选择话题对高中英语学习有价值、高阶、表意复杂、有文采的表达
3. 中文翻译应准确、地道，符合中文表达习惯
4. 少而精，数量上少提取而多取复杂结构

语块提取和时态语态微调示例：
- 介词性表达
    - 如“beneath the crass, striving materialism of American life”
    - 如“Nothing which is true or beautiful or good makes complete sense in any immediate context of history”提取为“in the immediate context of history”

- 名词性表达：
    - 如“a viable balance amid the eternal dialectics of the human condition”
    - 如“atomization and a slow descent toward nihilism”

- 动宾搭配：
    - 如原文“nurturing empathy and orienting the soul”必须修改为“nurture empathy and orient the soul”（必须将进行时形式变为动词原形）
    - 如原文“recoverd a smidgen of our earlier audacity”必须修改为“recover a smidgen of our earlier audacity”（必须将过去式形式变为动词原形）

- 富有表现力的复杂表达：
    - 如原文“True humanism, in contrast, is the antidote to nihilism”可提取为“True humanism is the antidote to nihilism”
    - 如原文“a humanistic renaissance is already happening on university campuses“可提取为“a humanistic renaissance happening on university campuses”

禁止提取的内容：
- 简单或基础的表达
- 专业术语或罕见词汇（除非在上下文中有特殊意义）
- 完整的句子（只提取有价值的片段）
- 单个单词

输出语汇形式要求：
- 总是以辞书形输出英文表达片段：除去被动语境，必须删去所有语尾屈折变化，例如除去“be used”用作被动的情况外，将”uses”“using”“used“一律转化为”use“原形
- 文中以被动语态出现的动词或形容词短语，在输出时必须补全缺少的be动词：例如“adorned with jewels”应改为“be adorned with jewels”，“awash with information”应改为“be awash with information”
- 若中文中出现省略号，必须在英文中也用省略号表示对应的部分
- 精挑细选出最精彩的语块，必须少于十个，最好不多于七个，且每个语块都是高阶表达
</instructions>

<output_format>
你必须输出一个JSON对象，包含一个entries数组，每个entry包含：
- english: 英文表达片段（原文中的chunk）
- chinese: 对应的中文翻译
</output_format>
`.trim()

export const buildChunkGenerationPrompt = (text: string, sectionType: string) => `
<section_type>
这是一个${SECTION_NAME_MAP[sectionType as keyof typeof SECTION_NAME_MAP] ?? sectionType}题型的文本。
</section_type>

<text>
${text}
</text>

请从上述文本中提取有价值的英语表达chunks，并提供准确的中文翻译。
`.trim()
