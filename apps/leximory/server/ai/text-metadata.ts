import 'server-only'
import { nanoAI } from './config'

export const emojiPrompt = (input: string) => ({
    instructions: `你是一个emoji选择器。根据文章的主题和氛围，选择一个最能代表这篇文章的emoji且新颖不落俗套。只输出一个emoji，不要输出任何其他内容。禁止选取可能引起强烈视觉不适的emoji，即禁止选取任何昆虫emoji。`,
    prompt: `为以下文章选择一个有表现力的emoji：\n\n${input.slice(0, 500)}`,
    maxOutputTokens: 20,
    ...nanoAI,
})
