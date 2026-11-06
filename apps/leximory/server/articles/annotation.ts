import { nanoAI } from '../ai/config'

export const topicsPrompt = (input: string) => ({
    instructions: `
    用1~3个中文标签表示下文的话题或关键词。每个关键词间用||分隔（双竖线）。
    `,
    prompt: `请从下文提取出1~3个中文标签表示下文的话题或关键词：
    
    ${input}`,
    maxOutputTokens: 100,
    ...nanoAI,
})

export const getFinalAiOutput = (result: unknown): string => {
    if (!result || typeof result !== 'object') return ''

    const response = result as Record<string, unknown>
    for (const key of ['_output', 'text']) {
        if (typeof response[key] === 'string') return response[key]
    }

    if (!Array.isArray(response.steps)) return ''

    for (let index = response.steps.length - 1; index >= 0; index--) {
        const step = response.steps[index]
        if (!step || typeof step !== 'object') continue

        const content = (step as Record<string, unknown>).content
        if (!Array.isArray(content)) continue

        const text = content
            .filter(
                (part) =>
                    part &&
                    typeof part === 'object' &&
                    (part as Record<string, unknown>).type === 'text' &&
                    typeof (part as Record<string, unknown>).text === 'string',
            )
            .map((part) => (part as Record<string, string>).text)
            .join('')

        if (text) return text
    }

    return ''
}

export const titlePrompt = (input: string) => ({
    instructions: `你是一个标题生成器。根据文章内容生成一个简洁、准确、有吸引力的标题。用文章的原语言输出标题。只输出标题文本，不要输出任何其他内容、引号或标点符号包裹。`,
    prompt: `为以下文章生成一个标题：\n\n${input.slice(0, 2000)}`,
    maxOutputTokens: 60,
    ...nanoAI,
})

export const chunkText = (text: string, maxLength: number): string[] => {
    // Handle edge cases
    if (!text) return []
    if (text.length <= maxLength) return [text]

    const chunks: string[] = []

    // Split by paragraphs (double newline)
    const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim())
    let currentChunk = ''

    for (const paragraph of paragraphs) {
        // Case 1: Single paragraph longer than maxLength
        if (paragraph.length >= maxLength) {
            // Push existing chunk if any
            if (currentChunk) {
                chunks.push(currentChunk.trim())
                currentChunk = ''
            }

            // Split long paragraph by sentences when possible
            const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph]

            let sentenceChunk = ''
            for (const sentence of sentences) {
                if (sentence.length >= maxLength) {
                    // If single sentence is too long, split by maxLength
                    if (sentenceChunk) {
                        chunks.push(sentenceChunk.trim())
                        sentenceChunk = ''
                    }
                    for (let i = 0; i < sentence.length; i += maxLength) {
                        chunks.push(sentence.slice(i, Math.min(i + maxLength, sentence.length)).trim())
                    }
                } else if ((sentenceChunk + sentence).length >= maxLength) {
                    chunks.push(sentenceChunk.trim())
                    sentenceChunk = sentence
                } else {
                    sentenceChunk += sentence
                }
            }
            if (sentenceChunk) chunks.push(sentenceChunk.trim())
            continue
        }

        // Case 2: Normal paragraph handling
        if ((currentChunk + paragraph).length >= maxLength) {
            chunks.push(currentChunk.trim())
            currentChunk = paragraph + '\n\n'
        } else {
            currentChunk += paragraph + '\n\n'
        }
    }

    // Push final chunk if exists
    if (currentChunk) {
        chunks.push(currentChunk.trim())
    }

    return chunks.filter((chunk) => chunk)
}
