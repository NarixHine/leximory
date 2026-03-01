import { inngest } from './client'
import { getPaper, getSubmissionById, updateSubmissionFeedback } from '@repo/supabase/paper'
import { generateObject } from 'ai'
import { FLASH_AI } from '@repo/service/ai/config'
import {
    SummaryData,
    TranslationData,
    WritingData,
    SummaryFeedbackSchema,
    TranslationFeedbackSchema,
    WritingFeedbackSchema,
    SUBJECTIVE_TYPES,
    SubmissionFeedback,
} from '@repo/schema/paper'
import type { SummaryFeedback, TranslationFeedback, WritingFeedback } from '@repo/schema/paper'
import { buildSummaryMarkingPrompt, buildTranslationMarkingPrompt, buildWritingScoringPrompt, buildWritingAnalysisPrompt } from '@repo/service/ai/prompts/subjective'
import { findCopiedChunks, countWords } from '@repo/utils/subjective'
import { z } from '@repo/schema'

/**
 * Inngest function that marks subjective sections (summary, translation, writing)
 * of a quiz submission asynchronously. Updates the submission's feedback and score.
 */
export const markSubjectiveSections = inngest.createFunction(
    { id: 'mark-subjective-sections', retries: 2 },
    { event: 'quiz/submission.marking' },
    async ({ event, step }) => {
        const { submissionId, paperId } = event.data

        const { paper, submission } = await step.run('fetch-data', async () => {
            const [paper, submission] = await Promise.all([
                getPaper({ id: paperId }),
                getSubmissionById({ id: submissionId }),
            ])
            return { paper, submission }
        })

        const answers = submission.answers
        const feedback: SubmissionFeedback = {}
        let subjectiveScore = 0

        // Find all subjective sections in the paper
        const subjectiveSections = paper.content.filter(
            (section) => (SUBJECTIVE_TYPES as readonly string[]).includes(section.type)
        )

        // Mark each subjective section
        for (const section of subjectiveSections) {
            if (section.type === 'summary') {
                const result = await step.run(`mark-summary-${section.id}`, async () => {
                    const data = section as SummaryData
                    const answer = answers[section.id]?.[1] ?? ''
                    const copiedChunks = findCopiedChunks(data.text, answer)
                    const wordCount = countWords(answer)
                    const prompt = buildSummaryMarkingPrompt(data, answer, copiedChunks, wordCount)

                    const { object } = await generateObject({
                        ...FLASH_AI,
                        prompt,
                        schema: SummaryFeedbackSchema.omit({ type: true, copiedChunks: true }),
                    })

                    return {
                        ...object,
                        type: 'summary' as const,
                        copiedChunks,
                    } satisfies SummaryFeedback
                })

                feedback[section.id] = result
                subjectiveScore += result.totalScore
            }

            if (section.type === 'translation') {
                const result = await step.run(`mark-translation-${section.id}`, async () => {
                    const data = section as TranslationData
                    const sectionAnswers = answers[section.id] ?? {}
                    const prompt = buildTranslationMarkingPrompt(data, sectionAnswers)

                    const { object } = await generateObject({
                        ...FLASH_AI,
                        prompt,
                        schema: TranslationFeedbackSchema.omit({ type: true }),
                    })

                    return {
                        ...object,
                        type: 'translation' as const,
                    } satisfies TranslationFeedback
                })

                feedback[section.id] = result
                subjectiveScore += result.totalScore
            }

            if (section.type === 'writing') {
                // Step 1: Score the essay
                const scores = await step.run(`score-writing-${section.id}`, async () => {
                    const data = section as WritingData
                    const answer = answers[section.id]?.[1] ?? ''
                    const prompt = buildWritingScoringPrompt(data, answer)

                    const { object } = await generateObject({
                        ...FLASH_AI,
                        prompt,
                        schema: z.object({
                            contentScore: z.number(),
                            languageScore: z.number(),
                            structureScore: z.number(),
                            totalScore: z.number(),
                            rationale: z.string(),
                        }),
                    })

                    return object
                })

                // Step 2: Analyze the essay (badPairs, goodPairs, corrected)
                const analysis = await step.run(`analyze-writing-${section.id}`, async () => {
                    const data = section as WritingData
                    const answer = answers[section.id]?.[1] ?? ''
                    const prompt = buildWritingAnalysisPrompt(data, answer)

                    const { object } = await generateObject({
                        ...FLASH_AI,
                        prompt,
                        schema: z.object({
                            corrected: z.string(),
                            badPairs: z.array(z.object({ original: z.string(), improved: z.string() })),
                            goodPairs: z.array(z.object({ original: z.string(), why: z.string() })),
                        }),
                    })

                    return object
                })

                const writingFeedback: WritingFeedback = {
                    type: 'writing',
                    ...scores,
                    ...analysis,
                }

                feedback[section.id] = writingFeedback
                subjectiveScore += scores.totalScore
            }
        }

        // Update the submission with feedback and adjusted score
        await step.run('update-submission', async () => {
            const newScore = submission.score + subjectiveScore
            await updateSubmissionFeedback({
                submissionId,
                feedback: feedback as Record<string, unknown>,
                score: newScore,
            })
        })

        return { subjectiveScore, feedback }
    }
)
