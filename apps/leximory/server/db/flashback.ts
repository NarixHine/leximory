import { supabase } from '@repo/supabase'

interface FlashbackData {
    user: string
    date: string
    lang: string
    story: string
    translations: Array<{
        chinese: string
        answer: string
        keyword: string
    }>
    created_at: string
}

interface CreateFlashbackParams {
    userId: string
    date: string
    lang: string
    story: string
    translations: Array<{
        chinese: string
        answer: string
        keyword: string
    }>
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
        translations: (data.translations as FlashbackData['translations']) || [],
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
    const { data, error } = await supabase
        .from('flashbacks')
        .upsert({
            user: userId,
            date,
            lang,
            story,
            translations: translations as any,
            created_at: new Date().toISOString(),
        })
        .select()
        .single()

    if (error) {
        throw error
    }

    return data
}
