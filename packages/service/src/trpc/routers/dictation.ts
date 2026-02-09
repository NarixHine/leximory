import 'server-only'

import { z } from '@repo/schema'
import { getDictation, deleteDictation, createDictation, updateDictationContent } from '@repo/supabase/dictation'
import { getPaper } from '@repo/supabase/paper'
import { saveChunkNote, loadChunkNotes, deleteNote } from '@repo/supabase/question-note'
import { acquireDictationLock, releaseDictationLock } from '@repo/kv'
import { DictationContent, DictationContentSchema } from '@repo/schema/chunk-note'
import { generateChunksForSection } from '../../ai'
import { ACTION_QUOTA_COST } from '@repo/env/config'
import incrCommentaryQuota from '@repo/user/quota'
import { Kilpi } from '../../kilpi'
import { router, publicProcedure, authedProcedure } from '../init'

export const dictationRouter = router({
  /**
   * Gets a dictation for a paper.
   */
  get: publicProcedure
    .input(z.object({
      paperId: z.number(),
    }))
    .query(async ({ input }) => {
      const paper = await getPaper({ id: input.paperId })
      await Kilpi.papers.read(paper).authorize().assert()

      return await getDictation({ paperId: input.paperId })
    }),

  /**
   * Generates a dictation for a paper (authenticated users only).
   */
  generate: authedProcedure
    .input(z.object({
      paperId: z.number(),
    }))
    .mutation(async ({ input }) => {
      if (await incrCommentaryQuota(ACTION_QUOTA_COST.quiz.dictation)) {
        throw new Error('You have reached your dictation generation quota limit.')
      }
      // Try to acquire lock to prevent concurrent generation
      const lockAcquired = await acquireDictationLock({ paperId: input.paperId })
      if (!lockAcquired) {
        throw new Error('Dictation generation is already in progress for this paper')
      }

      try {
        // Check if dictation already exists
        const existingDictation = await getDictation({ paperId: input.paperId })
        if (existingDictation) {
          await releaseDictationLock({ paperId: input.paperId })
          return existingDictation
        }

        // Get the paper content
        const paper = await getPaper({ id: input.paperId })
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
          paperId: input.paperId,
          content: dictationContent,
        })

        // Release the lock
        await releaseDictationLock({ paperId: input.paperId })

        return {
          ...dictation,
          content: dictationContent,
        }
      } catch (error) {
        await releaseDictationLock({ paperId: input.paperId })
        throw error
      }
    }),

  /**
   * Deletes a dictation (owner only).
   */
  delete: authedProcedure
    .input(z.object({
      paperId: z.number(),
      dictationId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const paper = await getPaper({ id: input.paperId })
      await Kilpi.papers.update(paper).authorize().assert()

      await deleteDictation({ id: input.dictationId })
    }),

  /**
   * Saves a chunk note from dictation.
   */
  saveChunkNote: authedProcedure
    .input(z.object({
      english: z.string(),
      chinese: z.string(),
      paperId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await saveChunkNote({
        english: input.english,
        chinese: input.chinese,
        relatedPaper: input.paperId,
        creator: ctx.user.userId,
      })

      return result.id
    }),

  /**
   * Gets recent chunk notes for the current user.
   */
  getRecentChunkNotes: authedProcedure
    .input(z.object({
      cursor: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      return await loadChunkNotes({ cursor: input.cursor, creator: ctx.user.userId })
    }),

  /**
   * Deletes a chunk note by ID.
   */
  deleteChunkNote: authedProcedure
    .input(z.object({
      noteId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      await deleteNote({ id: input.noteId, creator: ctx.user.userId })
    }),

  /**
   * Deletes an entry from a dictation (owner only).
   * Removes the entry at the specified section and entry index.
   */
  deleteEntry: authedProcedure
    .input(z.object({
      paperId: z.number(),
      dictationId: z.number(),
      sectionIndex: z.number(),
      entryEnglish: z.string(),
    }))
    .mutation(async ({ input }) => {
      const paper = await getPaper({ id: input.paperId })
      await Kilpi.papers.update(paper).authorize().assert()

      // Get current dictation
      const dictation = await getDictation({ paperId: input.paperId })
      if (!dictation || dictation.id !== input.dictationId) {
        throw new Error('Dictation not found')
      }

      // Remove the entry from the section
      const newSections = dictation.content.sections.map((section, sIdx) => {
        if (sIdx === input.sectionIndex) {
          return {
            ...section,
            entries: section.entries.filter(entry => entry.english !== input.entryEnglish)
          }
        }
        return section
      }).filter(section => section.entries.length > 0) // Remove empty sections

      // Update the dictation content
      const newContent: DictationContent = { sections: newSections }
      await updateDictationContent({ id: input.dictationId, content: newContent })

      return newContent
    }),
})
