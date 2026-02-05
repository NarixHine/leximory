import 'server-only'
import { generateObject } from 'ai'
import { FLASH_AI } from '../config'
import { ChunkGenerationResponseSchema } from '@repo/schema/chunk-note'
import { buildChunkGenerationPrompt, buildChunkGenerationSystemPrompt, extractTextFromQuizData } from '../prompts/dictation'
import type { QuizData } from '@repo/schema/paper'

export interface GenerateChunksParams {
    quizData: QuizData
}

/**
 * Generates English-Chinese chunk pairs for a single section.
 */
export async function generateChunksForSection({ quizData }: GenerateChunksParams) {
    const text = extractTextFromQuizData(quizData)

    // Skip if no meaningful text
    if (!text || text.length < 50) {
        return { entries: [] }
    }

    const { object } = await generateObject({
        prompt: buildChunkGenerationPrompt(text, quizData.type),
        system: buildChunkGenerationSystemPrompt(),
        maxOutputTokens: 4000,
        ...FLASH_AI,
        schema: ChunkGenerationResponseSchema,
    })

    return object
}
