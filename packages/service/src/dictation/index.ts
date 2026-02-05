'use server'

import { actionClient } from '../safe-action-client'
import { z } from '@repo/schema'
import { getUserOrThrow } from '@repo/user'
import { Kilpi } from '../kilpi'
import { getDictation, createDictation, deleteDictation } from '@repo/supabase/dictation'
import { getPaper } from '@repo/supabase/paper'
import { saveChunkNote, loadChunkNotes } from '@repo/supabase/question-note'
import { revalidateTag } from 'next/cache'

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
        revalidateTag(`dictation:${paperId}`)
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
