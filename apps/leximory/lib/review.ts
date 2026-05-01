import { z } from '@repo/schema'

export const ReviewTranslationStatusSchema = z.enum(['idle', 'pending', 'complete', 'failed'])
export type ReviewTranslationStatus = z.infer<typeof ReviewTranslationStatusSchema>

export const ReviewTranslationFeedbackSchema = z.object({
    rationale: z.string(),
    badPairs: z.array(z.object({
        original: z.string(),
        improved: z.string(),
    })),
})
export type ReviewTranslationFeedback = z.infer<typeof ReviewTranslationFeedbackSchema>

export const ReviewTranslationSchema = z.object({
    prompt: z.string().optional(),
    chinese: z.string().optional(),
    answer: z.string(),
    keyword: z.string(),
    submission: z.string().nullable().optional(),
    status: ReviewTranslationStatusSchema.optional(),
    feedback: ReviewTranslationFeedbackSchema.nullable().optional(),
    submittedAt: z.string().nullable().optional(),
    evaluatedAt: z.string().nullable().optional(),
})
type ReviewTranslationSchemaData = z.infer<typeof ReviewTranslationSchema>

export type ReviewTranslation = Omit<ReviewTranslationSchemaData, 'prompt' | 'chinese'> & {
    prompt: string
}

export function normalizeReviewTranslation(raw: unknown): ReviewTranslation | null {
    const parsed = ReviewTranslationSchema.safeParse(raw)
    if (!parsed.success) return null

    const prompt = parsed.data.prompt ?? parsed.data.chinese ?? ''

    return {
        answer: parsed.data.answer,
        keyword: parsed.data.keyword,
        prompt,
        submission: parsed.data.submission ?? null,
        status: parsed.data.status ?? 'idle',
        feedback: parsed.data.feedback ?? null,
        submittedAt: parsed.data.submittedAt ?? null,
        evaluatedAt: parsed.data.evaluatedAt ?? null,
    }
}

export function normalizeReviewTranslations(raw: unknown): ReviewTranslation[] {
    if (!Array.isArray(raw)) return []
    return raw.map(normalizeReviewTranslation).filter((item): item is ReviewTranslation => item !== null)
}

export function isTranslationCompleted(translation: Pick<ReviewTranslation, 'status'>) {
    return translation.status === 'complete'
}

export function getReviewCompletion({
    story,
    translations,
}: {
    story?: string | null
    translations?: ReviewTranslation[] | null
}) {
    const normalizedTranslations = translations ?? []
    const totalUnits = (story ? 1 : 0) + normalizedTranslations.length
    if (totalUnits === 0) {
        return {
            completedUnits: 0,
            totalUnits: 0,
            percentage: 0,
            completedTranslations: 0,
            totalTranslations: 0,
            isComplete: false,
        }
    }

    const completedTranslations = normalizedTranslations.filter(isTranslationCompleted).length
    const completedUnits = (story ? 1 : 0) + completedTranslations

    return {
        completedUnits,
        totalUnits,
        percentage: Math.floor((completedUnits / totalUnits) * 100),
        completedTranslations,
        totalTranslations: normalizedTranslations.length,
        isComplete: completedUnits === totalUnits,
    }
}
