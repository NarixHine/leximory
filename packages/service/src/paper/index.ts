'use server'

import { actionClient } from '@repo/service'
import { z } from '@repo/schema'
import { Kilpi } from '../kilpi'
import { createPaper, getPaper, getPapersByCreator, getPublicPapers, updatePaper, togglePaperVisibility, deletePaper } from '@repo/supabase/paper'
import { getUserOrThrow } from '@repo/user'
import { QuizData, QuizItemsSchema } from '@repo/schema/paper'
import { streamExplanation } from '../ai'
import { SECTION_NAME_MAP } from '@repo/env/config'

const createPaperSchema = z.object({
  content: QuizItemsSchema.optional(),
  public: z.boolean().optional(),
  title: z.string().optional(),
})

const getPaperSchema = z.object({
  id: z.number(),
})

const updatePaperSchema = z.object({
  id: z.number(),
  data: z.object({
    content: QuizItemsSchema.optional(),
    public: z.boolean().optional(),
    title: z.string().optional(),
  }),
})

const togglePaperVisibilitySchema = z.object({
  id: z.number(),
})

const deletePaperSchema = z.object({
  id: z.number(),
})

/**
 * Creates a new paper record with authorization check.
 * Only authenticated users can create papers.
 */
export const createPaperAction = actionClient
  .inputSchema(createPaperSchema)
  .action(async ({ parsedInput: input }) => {
    const user = await getUserOrThrow()
    await Kilpi.authed().authorize().assert()
    const paper = await createPaper({ data: { ...input, creator: user.userId } })
    return paper
  })

/**
 * Retrieves a paper by ID with authorization check.
 * Users can read their own papers or public papers.
 */
export const getPaperAction = actionClient
  .inputSchema(getPaperSchema)
  .action(async ({ parsedInput: { id } }) => {
    const paper = await getPaper({ id })

    await Kilpi.papers.read(paper).authorize().assert()

    return paper
  })

/**
 * Retrieves all papers created by the current user.
 * Only the creator can see their own papers.
 */
export const getPapersByCreatorAction = actionClient
  .action(async () => {
    const user = await getUserOrThrow()
    await Kilpi.authed().authorize().assert()

    return getPapersByCreator({ creator: user.userId })
  })

/**
 * Retrieves all public papers.
 * Anyone can read public papers.
 */
export const getPublicPapersAction = actionClient
  .action(async () => {
    return getPublicPapers()
  })

/**
 * Updates a paper with authorization check.
 * Only the creator can update their papers.
 */
export const updatePaperAction = actionClient
  .inputSchema(updatePaperSchema)
  .action(async ({ parsedInput: { id, data } }) => {
    const paper = await getPaper({ id })

    await Kilpi.papers.update(paper).authorize().assert()

    return updatePaper({
      id,
      data: {
        ...data,
        tags: data.content ? data.content.map(item => SECTION_NAME_MAP[item.type]) : undefined,
      }
    })
  })

/**
 * Toggles paper visibility with authorization check.
 * Only the creator can toggle visibility.
 */
export const togglePaperVisibilityAction = actionClient
  .inputSchema(togglePaperVisibilitySchema)
  .action(async ({ parsedInput: { id } }) => {
    const paper = await getPaper({ id })

    await Kilpi.papers.update(paper).authorize().assert()

    return togglePaperVisibility({ id })
  })

/**
 * Deletes a paper with authorization check.
 * Only the creator can delete their papers.
 */
export const deletePaperAction = actionClient
  .inputSchema(deletePaperSchema)
  .action(async ({ parsedInput: { id } }) => {
    const paper = await getPaper({ id })

    await Kilpi.papers.delete(paper).authorize().assert()

    return deletePaper({ id })
  })

export type StreamExplanationParams = {
  quizData: QuizData,
  questionNo: number,
  userAnswer: string
}

export async function streamExplanationAction({ quizData, questionNo, userAnswer }: StreamExplanationParams) {
  await Kilpi.papers.askAI().authorize().assert()
  return streamExplanation({ quizData, questionNo, userAnswer })
}
