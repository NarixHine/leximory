import { supabase } from '@repo/supabase'
import {
    normalizeReviewConversationPayload,
    normalizeReviewConversation,
    normalizeReviewTranslations,
    type ReviewConversation,
    type ReviewTranslation,
} from '@/lib/review'

interface FlashbackData {
    user: string
    date: string
    lang: string
    story: string
    translations: ReviewTranslation[]
    conversation: ReviewConversation | null
    created_at: string
}

interface CreateFlashbackParams {
    userId: string
    date: string
    lang: string
    story: string
    translations: ReviewTranslation[]
    conversation?: ReviewConversation | null
}

interface UpdateFlashbackReviewParams {
    userId: string
    date: string
    lang: string
    translations: ReviewTranslation[]
    conversation?: ReviewConversation | null
}

export async function getFlashback({
    userId,
    date,
    lang,
}: {
    userId: string
    date: string
    lang: string
}): Promise<FlashbackData | null> {
    const { data, error } = await supabase
        .from('flashbacks')
        .select('*')
        .eq('user', userId)
        .eq('date', date)
        .eq('lang', lang)
        .single()

    if (error) {
        if (error.code === 'PGRST116') {
            // No rows returned
            return null
        }
        throw error
    }

    if (!data) return null

    return {
        user: data.user || userId,
        date: data.date,
        lang: data.lang,
        story: data.story || '',
        ...normalizeReviewConversationPayload(data.translations, data.conversation),
        created_at: data.created_at,
    }
}

export async function createFlashback({
    userId,
    date,
    lang,
    story,
    translations,
    conversation,
}: CreateFlashbackParams) {
    const normalizedTranslations = normalizeReviewTranslations(translations)
    const normalizedConversation = conversation
        ? normalizeReviewConversation(conversation)
        : null

    const { data, error } = await supabase
        .from('flashbacks')
        .upsert({
            user: userId,
            date,
            lang,
            story,
            translations: normalizedTranslations as any,
            conversation: normalizedConversation as any,
            created_at: new Date().toISOString(),
        })
        .select()
        .single()

    if (error) {
        throw error
    }

    return data
}

export async function updateFlashbackReview({
    userId,
    date,
    lang,
    translations,
    conversation,
}: UpdateFlashbackReviewParams) {
    const normalizedTranslations = normalizeReviewTranslations(translations)
    const normalizedConversation = conversation
        ? normalizeReviewConversation(conversation)
        : null

    const { data, error } = await supabase
        .from('flashbacks')
        .update({
            translations: normalizedTranslations as any,
            conversation: normalizedConversation as any,
        })
        .eq('user', userId)
        .eq('date', date)
        .eq('lang', lang)
        .select()
        .single()

    if (error) {
        throw error
    }

    return data
}

export async function listFlashbacksWithin({
    userId,
    startDate,
    endDate,
}: {
    userId: string
    startDate: string
    endDate: string
}): Promise<Array<Pick<FlashbackData, 'date' | 'lang' | 'story' | 'translations' | 'conversation'>>> {
    const { data } = await supabase
        .from('flashbacks')
        .select('date, lang, story, translations, conversation')
        .eq('user', userId)
        .gte('date', startDate)
        .lte('date', endDate)
        .throwOnError()

    return data.map((row) => ({
        date: row.date,
        lang: row.lang,
        story: row.story || '',
        ...normalizeReviewConversationPayload(row.translations, row.conversation),
    }))
}
