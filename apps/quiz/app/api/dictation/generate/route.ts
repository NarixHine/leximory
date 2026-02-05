'use workflow'

import { getPaper } from '@repo/supabase/paper'
import { createDictation, getDictation } from '@repo/supabase/dictation'
import { generateChunksForSection } from '@repo/service/ai/dictation'
import { acquireDictationLock, releaseDictationLock } from '@repo/kv'
import { SECTION_NAME_MAP } from '@repo/env/config'
import type { DictationContent, ChunkSection } from '@repo/schema/chunk-note'
import type { QuizItems } from '@repo/schema/paper'

export async function POST(request: Request) {
    const { paperId } = await request.json() as { paperId: number }
    
    // Try to acquire lock to prevent concurrent generation
    const lockAcquired = await acquireDictationLock({ paperId })
    if (!lockAcquired) {
        return Response.json({ 
            error: 'Dictation generation is already in progress for this paper' 
        }, { status: 409 })
    }
    
    try {
        // Check if dictation already exists
        const existingDictation = await getDictation({ paperId })
        if (existingDictation) {
            await releaseDictationLock({ paperId })
            return Response.json({ 
                success: true, 
                dictation: existingDictation,
                message: 'Dictation already exists' 
            })
        }
        
        // Get the paper content
        const paper = await getPaper({ id: paperId })
        const quizItems = paper.content as QuizItems
        
        // Generate chunks for each section sequentially
        const sections: ChunkSection[] = []
        
        for (const item of quizItems) {
            const sectionName = SECTION_NAME_MAP[item.type as keyof typeof SECTION_NAME_MAP] ?? item.type
            
            const result = await generateChunksForSection({ quizData: item })
            
            if (result.entries.length > 0) {
                sections.push({
                    sectionName,
                    sectionType: item.type,
                    entries: result.entries,
                })
            }
        }
        
        // Create the dictation content
        const dictationContent: DictationContent = { sections }
        
        // Save to database
        const dictation = await createDictation({
            paperId,
            content: dictationContent,
        })
        
        await releaseDictationLock({ paperId })
        
        return Response.json({ 
            success: true, 
            dictation: {
                id: dictation.id,
                content: dictationContent,
                createdAt: dictation.created_at,
            }
        })
    } catch (error) {
        await releaseDictationLock({ paperId })
        console.error('Dictation generation failed:', error)
        return Response.json({ 
            error: `Failed to generate dictation: ${error instanceof Error ? error.message : 'Unknown error'}` 
        }, { status: 500 })
    }
}
