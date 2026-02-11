'use server'

import { actionClient } from '@repo/service'
import { z } from '@repo/schema'
import { Kilpi } from '../kilpi'
import { createPaper, getPaper, getPapersByCreator, getPublicPapers, updatePaper, togglePaperVisibility, deletePaper, getPaperSubmission, submitPaper, getAllPaperSubmissions, setPaperPasscode } from '@repo/supabase/paper'
import { getUser, getUserOrThrow } from '@repo/user'
import { AskResponseSchema, QuizData, QuizItemsSchema, SectionAnswersSchema } from '@repo/schema/paper'
import { streamExplanation } from '../ai'
import { ACTION_QUOTA_COST, SECTION_NAME_MAP } from '@repo/env/config'
import incrCommentaryQuota from '@repo/user/quota'
import { getAskCache } from '@repo/kv'
import { hashAskParams } from '@repo/utils/paper'
import { revalidateTag } from 'next/cache'
import { nanoid } from 'nanoid'

const createPaperSchema = z.object({
  content: QuizItemsSchema.optional(),
  public: z.boolean().optional(),
  title: z.string().optional(),
})

const getPaperSchema = z.object({
  id: z.number(),
  passcode: z.string().optional(),
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

const paperPasscodeSchema = z.object({
  id: z.number(),
})

const deletePaperSchema = z.object({
  id: z.number(),
})

const getPaperSubmissionSchema = z.object({
  paperId: z.number(),
  passcode: z.string().optional(),
})

const submitPaperSchema = z.object({
  paperId: z.number(),
  answers: SectionAnswersSchema,
  score: z.number(),
  perfectScore: z.number(),
  passcode: z.string().optional(),
})

const fetchLeaderboardSchema = z.object({
  paperId: z.number(),
  passcode: z.string().optional(),
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

    revalidateTag('paper:public', 'max')
    return paper
  })

/**
 * Retrieves a paper by ID with authorization check.
 * Users can read their own papers or public papers.
 */
export const getPaperAction = actionClient
  .inputSchema(getPaperSchema)
  .action(async ({ parsedInput: { id, passcode } }) => {
    const paper = await getPaper({ id })

    await Kilpi.papers.read({ ...paper, providedPasscode: passcode }).authorize().assert()

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

    const result = await togglePaperVisibility({ id })

    revalidateTag('paper:public', 'max')
    return result
  })

/**
 * Generates a passcode on a paper if none exists.
 * Only the creator can manage passcodes.
 */
export const generatePaperPasscodeAction = actionClient
  .inputSchema(paperPasscodeSchema)
  .action(async ({ parsedInput: { id } }) => {
    const paper = await getPaper({ id })

    await Kilpi.papers.update(paper).authorize().assert()

    if (paper.passcode) return paper
    return setPaperPasscode({ id, passcode: nanoid(12) })
  })

/**
 * Revokes (clears) the passcode on a paper.
 * Only the creator can manage passcodes.
 */
export const revokePaperPasscodeAction = actionClient
  .inputSchema(paperPasscodeSchema)
  .action(async ({ parsedInput: { id } }) => {
    const paper = await getPaper({ id })

    await Kilpi.papers.update(paper).authorize().assert()

    return setPaperPasscode({ id, passcode: null })
  })

/**
 * Rotates the passcode on a paper (generates a new one).
 * Old share links will stop working.
 * Only the creator can manage passcodes.
 */
export const rotatePaperPasscodeAction = actionClient
  .inputSchema(paperPasscodeSchema)
  .action(async ({ parsedInput: { id } }) => {
    const paper = await getPaper({ id })

    await Kilpi.papers.update(paper).authorize().assert()

    return setPaperPasscode({ id, passcode: nanoid(12) })
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

    await deletePaper({ id })
    revalidateTag('paper:public', 'max')
  })

/**
 * Retrieves a paper submission of the current user with authorization check.
 */
export const getPaperSubmissionAction = actionClient
  .inputSchema(getPaperSubmissionSchema)
  .action(async ({ parsedInput: { paperId, passcode } }) => {
    const user = await getUser()
    if (!user) {
      return null
    }
    await Kilpi.authed().authorize().assert()
    return getPaperSubmission({ paperId, userId: user.userId })
  })

/**
 * Submits a paper with user answers and authorization check.
 * Users can submit public papers or their own papers.
 */
export const submitPaperAction = actionClient
  .inputSchema(submitPaperSchema)
  .action(async ({ parsedInput: { paperId, answers, score, perfectScore, passcode } }) => {
    const user = await getUserOrThrow()
    const paper = await getPaper({ id: paperId })

    await Kilpi.papers.submit({ ...paper, providedPasscode: passcode }).authorize().assert()

    return submitPaper({
      paperId,
      answers,
      score,
      perfectScore,
      userId: user.userId
    })
  })

/**
* Submits a paper with user answers and authorization check.
* Users can submit public papers or their own papers.
*/
export const fetchLeaderboardAction = actionClient
  .inputSchema(fetchLeaderboardSchema)
  .action(async ({ parsedInput: { paperId, passcode } }) => {
    const paper = await getPaper({ id: paperId })

    await Kilpi.papers.readSubmissions({ ...paper, providedPasscode: passcode }).authorize().assert()

    const submissions = await getAllPaperSubmissions({ paperId })
    return submissions.map(submission => ({
      score: submission.score,
      perfectScore: submission.perfect_score,
      user: submission.user
    }))
  })

export type StreamExplanationParams = {
  quizData: QuizData,
  questionNo: number,
  userAnswer: string
}

export async function streamExplanationAction({ quizData, questionNo, userAnswer }: StreamExplanationParams) {
  const { subject } = await Kilpi.papers.askAI().authorize().assert()
  const cache = await getAskCache({
    hash: hashAskParams({ quizData, questionNo, userAnswer }),
  })
  if (cache) {
    const { success, data } = AskResponseSchema.safeParse(cache)
    if (success) {
      return data
    }
  }
  if (await incrCommentaryQuota(ACTION_QUOTA_COST.quiz.ask, subject.userId)) {
    throw new Error('Quota exceeded')
  }

  return streamExplanation({ quizData, questionNo, userAnswer })
}
