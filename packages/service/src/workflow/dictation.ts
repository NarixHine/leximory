import 'server-only'
import { generateObject } from 'ai'
import { FLASH_AI } from '../ai/config'
import { ChunkGenerationResponseSchema } from '@repo/schema/chunk-note'
import { buildChunkGenerationPrompt, buildChunkGenerationSystemPrompt, extractTextFromQuizData } from '../ai/prompts/dictation'
import { getPaper } from '@repo/supabase/paper'
import { createDictation, getDictation } from '@repo/supabase/dictation'
import { acquireDictationLock, releaseDictationLock } from '@repo/kv'
import { SECTION_NAME_MAP } from '@repo/env/config'
import type { QuizData } from '@repo/schema/paper'
import type { ChunkSection, DictationContent, ChunkEntry } from '@repo/schema/chunk-note'

/**
 * Step: Generate chunks for a single section.
 * Each section is processed as an individual step that can be retried.
 */
async function generateSectionChunks(quizData: QuizData, sectionName: string): Promise<ChunkSection | null> {
    'use step'
    
    const text = extractTextFromQuizData(quizData)
    
    // Skip if no meaningful text
    if (!text || text.length < 50) {
        return null
    }
    
    const { object } = await generateObject({
        prompt: buildChunkGenerationPrompt(text, quizData.type),
        system: buildChunkGenerationSystemPrompt(),
        maxOutputTokens: 4000,
        ...FLASH_AI,
        schema: ChunkGenerationResponseSchema,
    })
    
    if (object.entries.length === 0) {
        return null
    }
    
    return {
        sectionName,
        sectionType: quizData.type,
        entries: object.entries,
    }
}

/**
 * Step: Save the generated dictation to the database.
 */
async function saveDictation(paperId: number, content: DictationContent) {
    'use step'
    
    const dictation = await createDictation({
        paperId,
        content,
    })
    
    return {
        id: dictation.id,
        content,
        createdAt: dictation.created_at,
    }
}

/**
 * Step: Release the generation lock.
 */
async function releaseLock(paperId: number) {
    'use step'
    
    await releaseDictationLock({ paperId })
}

/**
 * Workflow: Generate dictation for a paper.
 * Uses 'use workflow' directive for durable execution.
 * Processes all sections in parallel with Promise.all().
 */
export async function generateDictationWorkflow(paperId: number) {
    'use workflow'
    
    // Check if dictation already exists
    const existingDictation = await getDictation({ paperId })
    if (existingDictation) {
        return existingDictation
    }
    
    // Get the paper content
    const paper = await getPaper({ id: paperId })
    const quizItems = paper.content
    
    // Generate chunks for all sections in parallel
    const sectionPromises = quizItems.map((item) => {
        const sectionName = SECTION_NAME_MAP[item.type as keyof typeof SECTION_NAME_MAP] ?? item.type
        return generateSectionChunks(item, sectionName)
    })
    
    const sectionResults = await Promise.all(sectionPromises)
    
    // Filter out null results (sections with no meaningful content)
    const sections: ChunkSection[] = sectionResults.filter((section): section is ChunkSection => section !== null)
    
    // Create the dictation content
    const dictationContent: DictationContent = { sections }
    
    // Save to database
    const dictation = await saveDictation(paperId, dictationContent)
    
    // Release the lock
    await releaseLock(paperId)
    
    return dictation
}
