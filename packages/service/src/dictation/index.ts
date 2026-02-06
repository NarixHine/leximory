'use server'

import { actionClient } from '../safe-action-client'
import { z } from '@repo/schema'
import { getUserOrThrow } from '@repo/user'
import { Kilpi } from '../kilpi'
import { getDictation, deleteDictation, createDictation, updateDictationContent } from '@repo/supabase/dictation'
import { getPaper } from '@repo/supabase/paper'
import { saveChunkNote, loadChunkNotes, deleteNote } from '@repo/supabase/question-note'
import { acquireDictationLock, releaseDictationLock } from '@repo/kv'
import { DictationContent, DictationContentSchema } from '@repo/schema/chunk-note'
import { generateChunksForSection } from '../ai'

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

            // Generate chunks for all sections in parallel
            const sectionPromises = quizItems.map((item) => {
                return generateChunksForSection({ quizData: item })
            })

            const sectionResults = await Promise.all(sectionPromises)

            // Filter out null results (sections with no meaningful content)
            const sections = sectionResults.filter(section => section.entries.length > 0)

            // Create the dictation content
            const dictationContent: DictationContent = DictationContentSchema.parse({ sections })

            // Save to database
            const dictation = await createDictation({
                paperId,
                content: dictationContent,
            })

            // Release the lock
            await releaseDictationLock({ paperId })

            return {
                ...dictation,
                content: dictationContent,
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

/**
 * Deletes a chunk note by ID.
 */
export const deleteChunkNoteAction = actionClient
    .inputSchema(z.object({
        noteId: z.number(),
    }))
    .action(async ({ parsedInput: { noteId } }) => {
        await Kilpi.authed().authorize().assert()
        const { userId } = await getUserOrThrow()

        await deleteNote({ id: noteId, creator: userId })
    })

/**
 * Deletes an entry from a dictation (owner only).
 * Removes the entry at the specified section and entry index.
 */
export const deleteDictationEntryAction = actionClient
    .inputSchema(z.object({
        paperId: z.number(),
        dictationId: z.number(),
        sectionIndex: z.number(),
        entryEnglish: z.string(),
    }))
    .action(async ({ parsedInput: { paperId, dictationId, sectionIndex, entryEnglish } }) => {
        const paper = await getPaper({ id: paperId })
        await Kilpi.papers.update(paper).authorize().assert()

        // Get current dictation
        const dictation = await getDictation({ paperId })
        if (!dictation || dictation.id !== dictationId) {
            throw new Error('Dictation not found')
        }

        // Remove the entry from the section
        const newSections = dictation.content.sections.map((section, sIdx) => {
            if (sIdx === sectionIndex) {
                return {
                    ...section,
                    entries: section.entries.filter(entry => entry.english !== entryEnglish)
                }
            }
            return section
        }).filter(section => section.entries.length > 0) // Remove empty sections

        // Update the dictation content
        const newContent: DictationContent = { sections: newSections }
        await updateDictationContent({ id: dictationId, content: newContent })

        return newContent
    })
