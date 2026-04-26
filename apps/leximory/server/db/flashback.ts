import { supabase } from '@repo/supabase'
import { normalizeReviewTranslations, type ReviewTranslation } from '@/lib/review'

interface FlashbackData {
    user: string
    date: string
    lang: string
    story: string
    translations: ReviewTranslation[]
    created_at: string
}

interface CreateFlashbackParams {
    userId: string
    date: string
    lang: string
    story: string
    translations: ReviewTranslation[]
}

interface UpdateFlashbackTranslationsParams {
    userId: string
    date: string
    lang: string
    translations: ReviewTranslation[]
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
        translations: normalizeReviewTranslations(data.translations),
        created_at: data.created_at,
    }
}

export async function createFlashback({
    userId,
    date,
    lang,
    story,
    translations,
}: CreateFlashbackParams) {
    const normalizedTranslations = normalizeReviewTranslations(translations)

    const { data, error } = await supabase
        .from('flashbacks')
        .upsert({
            user: userId,
            date,
            lang,
            story,
            translations: normalizedTranslations as any,
            created_at: new Date().toISOString(),
        })
        .select()
        .single()

    if (error) {
        throw error
    }

    return data
}

export async function updateFlashbackTranslations({
    userId,
    date,
    lang,
    translations,
}: UpdateFlashbackTranslationsParams) {
    const normalizedTranslations = normalizeReviewTranslations(translations)

    const { data, error } = await supabase
        .from('flashbacks')
        .update({
            translations: normalizedTranslations as any,
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
}): Promise<Array<Pick<FlashbackData, 'date' | 'lang' | 'story' | 'translations'>>> {
    const { data } = await supabase
        .from('flashbacks')
        .select('date, lang, story, translations')
        .eq('user', userId)
        .gte('date', startDate)
        .lte('date', endDate)
        .throwOnError()

    return data.map((row) => ({
        date: row.date,
        lang: row.lang,
        story: row.story || '',
        translations: normalizeReviewTranslations(row.translations),
    }))
}
