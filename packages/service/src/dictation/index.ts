'use server'

import { actionClient } from '../safe-action-client'
import { z } from '@repo/schema'
import { getUserOrThrow } from '@repo/user'
import { Kilpi } from '../kilpi'
import { getDictation, createDictation, deleteDictation } from '@repo/supabase/dictation'
import { getPaper } from '@repo/supabase/paper'
import { saveChunkNote, loadChunkNotes } from '@repo/supabase/question-note'
import { generateChunksForSection } from '../ai/dictation'
import { acquireDictationLock, releaseDictationLock } from '@repo/kv'
import { SECTION_NAME_MAP } from '@repo/env/config'
import { revalidateTag } from 'next/cache'
import type { ChunkSection, DictationContent } from '@repo/schema/chunk-note'

/**
 * Gets a dictation for a paper.
 */
export const getDictationAction = actionClient
    .inputSchema(z.object({
        paperId: z.number(),
    }))
    .action(async ({ parsedInput: { paperId } }) => {
        const paper = await getPaper({ id: paperId })
        await Kilpi.papers.read(paper).authorize().assert()
        
        return await getDictation({ paperId })
    })

/**
 * Generates a dictation for a paper (authenticated users only).
 */
export const generateDictationAction = actionClient
    .inputSchema(z.object({
        paperId: z.number(),
    }))
    .action(async ({ parsedInput: { paperId } }) => {
        await Kilpi.authed().authorize().assert()
        
        // Try to acquire lock to prevent concurrent generation
        const lockAcquired = await acquireDictationLock({ paperId })
        if (!lockAcquired) {
            throw new Error('Dictation generation is already in progress for this paper')
        }
        
        try {
            // Check if dictation already exists
            const existingDictation = await getDictation({ paperId })
            if (existingDictation) {
                await releaseDictationLock({ paperId })
                return existingDictation
            }
            
            // Get the paper content
            const paper = await getPaper({ id: paperId })
            const quizItems = paper.content
            
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
            
            return {
                id: dictation.id,
                content: dictationContent,
                createdAt: dictation.created_at,
            }
        } catch (error) {
            await releaseDictationLock({ paperId })
            throw error
        }
    })

/**
 * Deletes a dictation (owner only).
 */
export const deleteDictationAction = actionClient
    .inputSchema(z.object({
        paperId: z.number(),
        dictationId: z.number(),
    }))
    .action(async ({ parsedInput: { paperId, dictationId } }) => {
        const paper = await getPaper({ id: paperId })
        await Kilpi.papers.update(paper).authorize().assert()
        
        await deleteDictation({ id: dictationId })
        revalidateTag(`dictation:${paperId}`, 'max')
    })

/**
 * Saves a chunk note from dictation.
 */
export const saveChunkNoteAction = actionClient
    .inputSchema(z.object({
        english: z.string(),
        chinese: z.string(),
        paperId: z.number().optional(),
    }))
    .action(async ({ parsedInput: { english, chinese, paperId } }) => {
        await Kilpi.authed().authorize().assert()
        const { userId } = await getUserOrThrow()
        
        const result = await saveChunkNote({
            english,
            chinese,
            relatedPaper: paperId,
            creator: userId,
        })
        
        return result.id
    })

/**
 * Gets recent chunk notes for the current user.
 */
export const getRecentChunkNotesAction = actionClient
    .inputSchema(z.object({
        cursor: z.string().optional(),
    }))
    .action(async ({ parsedInput: { cursor } }) => {
        const { userId } = await getUserOrThrow()
        return await loadChunkNotes({ cursor, creator: userId })
    })
