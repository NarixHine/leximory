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
    { id: 'mark-subjective-sections', retries: 2, idempotency: 'event.data.submissionId' },
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

        // Find all subjective sections in the paper
        const subjectiveSections = paper.content.filter(
            (section) => (SUBJECTIVE_TYPES as readonly string[]).includes(section.type)
        )

        // Mark each subjective section
        for (const section of subjectiveSections) {
            if (section.type === 'summary') {
                const answer = answers[section.id]?.[1] ?? ''

                if (!answer.trim()) {
                    feedback[section.id] = {
                        type: 'summary',
                        contentScore: 0,
                        languageScore: 0,
                        totalScore: 0,
                        essentialItemResults: [],
                        extraItemResults: [],
                        copiedChunks: [],
                        rationale: '',
                    } satisfies SummaryFeedback
                    continue
                }

                feedback[section.id] = await step.run(`mark-summary-${section.id}`, async () => {
                    const data = section as SummaryData
                    const copiedChunks = findCopiedChunks(data.text, answer)
                    const wordCount = countWords(answer)
                    const prompt = buildSummaryMarkingPrompt(data, answer, copiedChunks, wordCount)

                    const { object } = await generateObject({
                        ...FLASH_AI,
                        prompt,
                        schema: SummaryFeedbackSchema.omit({ type: true, copiedChunks: true, contentScore: true, totalScore: true }),
                    })

                    // Deterministic content score: each essential = 1pt, extras only if ALL essentials fulfilled, cap 5
                    const essentialFulfilled = object.essentialItemResults.filter(r => r.fulfilled).length
                    const allEssentialsFulfilled = essentialFulfilled === data.essentialItems.length
                    const extraFulfilled = allEssentialsFulfilled
                        ? object.extraItemResults.filter(r => r.fulfilled).length
                        : 0
                    const contentScore = Math.min(essentialFulfilled + extraFulfilled, 5)

                    // Clamp language score to [0,5] and enforce ±2 from content score
                    const languageScore = Math.max(0, Math.min(5,
                        Math.max(contentScore - 2, Math.min(object.languageScore, contentScore + 2)),
                    ))

                    return {
                        ...object,
                        type: 'summary' as const,
                        copiedChunks,
                        contentScore,
                        languageScore,
                        totalScore: contentScore + languageScore,
                    } satisfies SummaryFeedback
                })
            }

            if (section.type === 'translation') {
                const data = section as TranslationData
                const sectionAnswers = answers[section.id] ?? {}
                const hasAnyAnswer = Object.values(sectionAnswers).some(v => v != null && v.trim() !== '')

                if (!hasAnyAnswer) {
                    feedback[section.id] = {
                        type: 'translation',
                        items: data.items.map(item => ({
                            score: 0,
                            maxScore: item.score,
                            rationale: '',
                            badPairs: [],
                        })),
                        totalScore: 0,
                    } satisfies TranslationFeedback
                    continue
                }

                feedback[section.id] = await step.run(`mark-translation-${section.id}`, async () => {
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
            }

            if (section.type === 'writing') {
                const answer = answers[section.id]?.[1] ?? ''

                if (!answer.trim()) {
                    feedback[section.id] = {
                        type: 'writing',
                        contentScore: 0,
                        languageScore: 0,
                        structureScore: 0,
                        totalScore: 0,
                        rationale: '',
                        corrected: '',
                        badPairs: [],
                        goodPairs: [],
                    } satisfies WritingFeedback
                    continue
                }

                // Step 1: Score the essay
                const scores = await step.run(`score-writing-${section.id}`, async () => {
                    const data = section as WritingData
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

                feedback[section.id] = {
                    type: 'writing',
                    ...scores,
                    ...analysis,
                } satisfies WritingFeedback
            }
        }

        // Compute subjective score deterministically from feedback — not via
        // a mutable accumulator that would re-run on every Inngest invocation.
        const subjectiveScore = Object.values(feedback).reduce(
            (sum, fb) => sum + fb.totalScore, 0
        )

        // Update the submission with feedback and adjusted score
        await step.run('update-submission', async () => {
            await updateSubmissionFeedback({
                submissionId,
                feedback: JSON.parse(JSON.stringify(feedback)),
                score: submission.score + subjectiveScore,
            })
        })

        return { subjectiveScore, feedback }
    }
)
