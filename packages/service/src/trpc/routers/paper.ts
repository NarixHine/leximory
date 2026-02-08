import 'server-only'

import { z } from '@repo/schema'
import { Kilpi } from '../../kilpi'
import { createPaper, getPaper, getPapersByCreator, getPublicPapers, updatePaper, togglePaperVisibility, deletePaper, getPaperSubmission, submitPaper, getAllPaperSubmissions } from '@repo/supabase/paper'
import { QuizItemsSchema, SectionAnswersSchema } from '@repo/schema/paper'
import { SECTION_NAME_MAP } from '@repo/env/config'
import { revalidateTag } from 'next/cache'
import { router, publicProcedure, authedProcedure } from '../init'

export const paperRouter = router({
  /**
   * Creates a new paper record with authorization check.
   * Only authenticated users can create papers.
   */
  create: authedProcedure
    .input(z.object({
      content: QuizItemsSchema.optional(),
      public: z.boolean().optional(),
      title: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const paper = await createPaper({ data: { ...input, creator: ctx.user.userId } })
      revalidateTag('paper:public', 'max')
      return paper
    }),

  /**
   * Retrieves a paper by ID with authorization check.
   * Users can read their own papers or public papers.
   */
  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const paper = await getPaper({ id: input.id })
      await Kilpi.papers.read(paper).authorize().assert()
      return paper
    }),

  /**
   * Retrieves all papers created by the current user.
   * Only the creator can see their own papers.
   */
  getByCreator: authedProcedure
    .query(async ({ ctx }) => {
      return getPapersByCreator({ creator: ctx.user.userId })
    }),

  /**
   * Retrieves all public papers.
   * Anyone can read public papers.
   */
  getPublic: publicProcedure
    .query(async () => {
      return getPublicPapers()
    }),

  /**
   * Updates a paper with authorization check.
   * Only the creator can update their papers.
   */
  update: authedProcedure
    .input(z.object({
      id: z.number(),
      data: z.object({
        content: QuizItemsSchema.optional(),
        public: z.boolean().optional(),
        title: z.string().optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      const paper = await getPaper({ id: input.id })
      await Kilpi.papers.update(paper).authorize().assert()

      return updatePaper({
        id: input.id,
        data: {
          ...input.data,
          tags: input.data.content ? input.data.content.map(item => SECTION_NAME_MAP[item.type]) : undefined,
        }
      })
    }),

  /**
   * Toggles paper visibility with authorization check.
   * Only the creator can toggle visibility.
   */
  toggleVisibility: authedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const paper = await getPaper({ id: input.id })
      await Kilpi.papers.update(paper).authorize().assert()

      const result = await togglePaperVisibility({ id: input.id })
      revalidateTag('paper:public', 'max')
      return result
    }),

  /**
   * Deletes a paper with authorization check.
   * Only the creator can delete their papers.
   */
  delete: authedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const paper = await getPaper({ id: input.id })
      await Kilpi.papers.delete(paper).authorize().assert()

      await deletePaper({ id: input.id })
      revalidateTag('paper:public', 'max')
    }),

  /**
   * Retrieves a paper submission of the current user with authorization check.
   */
  getSubmission: publicProcedure
    .input(z.object({ paperId: z.number() }))
    .query(async ({ input, ctx }) => {
      if (!ctx.user) {
        return null
      }
      await Kilpi.authed().authorize().assert()
      return getPaperSubmission({ paperId: input.paperId, userId: ctx.user.userId })
    }),

  /**
   * Submits a paper with user answers and authorization check.
   * Users can submit public papers or their own papers.
   */
  submit: authedProcedure
    .input(z.object({
      paperId: z.number(),
      answers: SectionAnswersSchema,
      score: z.number(),
      perfectScore: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const paper = await getPaper({ id: input.paperId })
      await Kilpi.papers.submit(paper).authorize().assert()

      return submitPaper({
        paperId: input.paperId,
        answers: input.answers,
        score: input.score,
        perfectScore: input.perfectScore,
        userId: ctx.user.userId
      })
    }),

  /**
   * Fetches leaderboard for a paper
   */
  fetchLeaderboard: publicProcedure
    .input(z.object({ paperId: z.number() }))
    .query(async ({ input }) => {
      const paper = await getPaper({ id: input.paperId })
      await Kilpi.papers.readSubmissions(paper).authorize().assert()

      const submissions = await getAllPaperSubmissions({ paperId: input.paperId })
      return submissions.map(submission => ({
        score: submission.score,
        perfectScore: submission.perfect_score,
        user: submission.user
      }))
    }),
})
