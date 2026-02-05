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
你的任务是从给定的英语文本中提取有价值的表达片段（chunks），并提供准确的中文翻译。

什么是值得提取的chunks：
- 介词性表达（prepositional phrases）：如 "at the forefront of innovation"
- 名词性表达（noun phrases）：如 "a wealth of experience to tap into", "a far cry from the brutal reality"
- 动宾搭配（verb-object collocations）：如 "emerge from pandemic hibernation", "shed light on unknown aspects"
- 精妙/高级/有表现力的复杂表达：如 "a quieter upheaval taking place behind closed doors", "be swept up into altercations"

禁止提取的内容：
- 过于简单或基础的表达（如 "very good", "a lot of"）
- 专业术语或罕见词汇（除非在上下文中有特殊意义）
- 完整的句子（只提取有价值的片段）
- 单个单词

提取原则：
1. 每个chunk应该是一个完整的表达单位，可以独立使用
2. 优先选择对高中生英语学习有价值的表达
3. 中文翻译应准确、地道，符合中文表达习惯
4. 每个section提取5-15个chunks（根据文本长度和内容质量调整）
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
