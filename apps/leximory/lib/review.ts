import { z } from '@repo/schema'

export const ReviewTranslationStatusSchema = z.enum(['idle', 'pending', 'complete', 'failed'])
export type ReviewTranslationStatus = z.infer<typeof ReviewTranslationStatusSchema>

export const LEXIMORY_WORLD_VIEW = `
Leximory 世界观：
「在猫忆的世界里，语言是心灵的纽带」(In the world of Leximory, language bonds the hearts.)
小白猫爱上了小黑猫。他想要了解她、深入她。他也想被她了解、被她发现。
但是——他和她语言不通。
你愿意肩负牵起他们之间的心灵连结的重任吗？（用户）`

export const REVIEW_CONVERSATION_UNLOCK_PERCENT = 60

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

export const ReviewConversationFeedbackSchema = z.object({
    rationale: z.string(),
    goodPairs: z.array(z.object({
        original: z.string(),
        note: z.string(),
    })),
    badPairs: z.array(z.object({
        original: z.string(),
        improved: z.string(),
    })),
})
export type ReviewConversationFeedback = z.infer<typeof ReviewConversationFeedbackSchema>

export const ReviewConversationSchema = z.object({
    worldView: z.string().default(LEXIMORY_WORLD_VIEW),
    prompt: z.string(),
    keywords: z.array(z.string()).default([]),
    submission: z.string().nullable().optional(),
    status: ReviewTranslationStatusSchema.optional(),
    feedback: ReviewConversationFeedbackSchema.nullable().optional(),
    reply: z.string().nullable().optional(),
    submittedAt: z.string().nullable().optional(),
    evaluatedAt: z.string().nullable().optional(),
})
export type ReviewConversation = z.infer<typeof ReviewConversationSchema>

export const ReviewConversationPayloadSchema = z.object({
    translations: z.array(ReviewTranslationSchema).default([]),
    conversation: ReviewConversationSchema.nullable().optional(),
})
type ReviewConversationPayload = z.infer<typeof ReviewConversationPayloadSchema>

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

export function normalizeReviewConversation(raw: unknown): ReviewConversation | null {
    const parsed = ReviewConversationSchema.safeParse(raw)
    if (!parsed.success) return null

    return {
        worldView: parsed.data.worldView || LEXIMORY_WORLD_VIEW,
        prompt: parsed.data.prompt,
        keywords: parsed.data.keywords ?? [],
        submission: parsed.data.submission ?? null,
        status: parsed.data.status ?? 'idle',
        feedback: parsed.data.feedback ?? null,
        reply: parsed.data.reply ?? null,
        submittedAt: parsed.data.submittedAt ?? null,
        evaluatedAt: parsed.data.evaluatedAt ?? null,
    }
}

export function normalizeReviewConversationPayload(rawTranslations: unknown, rawConversation?: unknown) {
    if (Array.isArray(rawTranslations)) {
        return {
            translations: normalizeReviewTranslations(rawTranslations),
            conversation: normalizeReviewConversation(rawConversation),
        }
    }

    const parsed = ReviewConversationPayloadSchema.safeParse(rawTranslations)
    if (!parsed.success) {
        return {
            translations: [],
            conversation: normalizeReviewConversation(rawConversation),
        }
    }

    return {
        translations: normalizeReviewTranslations(parsed.data.translations),
        conversation: normalizeReviewConversation(parsed.data.conversation ?? rawConversation),
    }
}

export function serializeReviewConversationPayload({
    translations,
    conversation,
}: {
    translations: ReviewTranslation[]
    conversation?: ReviewConversation | null
}): ReviewConversationPayload {
    return {
        translations: normalizeReviewTranslations(translations),
        conversation: conversation ? normalizeReviewConversation(conversation) : null,
    }
}

export function isTranslationCompleted(translation: Pick<ReviewTranslation, 'status'>) {
    return translation.status === 'complete'
}

export function isConversationCompleted(conversation: Pick<ReviewConversation, 'status'> | null | undefined) {
    return conversation?.status === 'complete'
}

export function getConversationUnlockProgress(translations: Pick<ReviewTranslation, 'status'>[] | null | undefined) {
    const normalizedTranslations = translations ?? []
    const totalTranslations = normalizedTranslations.length
    const completedTranslations = normalizedTranslations.filter(isTranslationCompleted).length
    const requiredTranslations = totalTranslations === 0
        ? 0
        : Math.ceil((totalTranslations * REVIEW_CONVERSATION_UNLOCK_PERCENT) / 100)
    const translationProgressPercent = totalTranslations === 0
        ? 0
        : Math.floor((completedTranslations / totalTranslations) * 100)

    return {
        completedTranslations,
        totalTranslations,
        requiredTranslations,
        translationProgressPercent,
        isUnlocked: totalTranslations > 0 && completedTranslations >= requiredTranslations,
    }
}

export function getReviewCompletion({
    story,
    translations,
    conversation,
}: {
    story?: string | null
    translations?: ReviewTranslation[] | null
    conversation?: ReviewConversation | null
}) {
    const normalizedTranslations = translations ?? []
    const unlockProgress = getConversationUnlockProgress(normalizedTranslations)
    const conversationCompleted = isConversationCompleted(conversation)
    const totalUnits = (story ? 1 : 0) + normalizedTranslations.length + (conversation ? 1 : 0)
    if (totalUnits === 0) {
        return {
            completedUnits: 0,
            totalUnits: 0,
            percentage: 0,
            completedTranslations: 0,
            totalTranslations: 0,
            translationProgressPercent: 0,
            conversationUnlocked: false,
            conversationCompleted: false,
            isComplete: false,
        }
    }

    const completedTranslations = normalizedTranslations.filter(isTranslationCompleted).length
    const completedUnits = (story ? 1 : 0) + completedTranslations + (conversationCompleted ? 1 : 0)
    const baseStoryProgress = story ? 1 : 0
    const translationProgress = Math.min(REVIEW_CONVERSATION_UNLOCK_PERCENT, Math.floor(
        (unlockProgress.translationProgressPercent / 100) * REVIEW_CONVERSATION_UNLOCK_PERCENT
    ))
    const percentage = conversationCompleted
        ? 100
        : Math.max(baseStoryProgress, translationProgress)

    return {
        completedUnits,
        totalUnits,
        percentage,
        completedTranslations,
        totalTranslations: normalizedTranslations.length,
        translationProgressPercent: unlockProgress.translationProgressPercent,
        conversationUnlocked: unlockProgress.isUnlocked,
        conversationCompleted,
        isComplete: conversation ? completedUnits === totalUnits : completedUnits === ((story ? 1 : 0) + normalizedTranslations.length),
    }
}
