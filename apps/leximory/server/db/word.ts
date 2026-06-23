import { Lang } from '@repo/env/config'
import { languageWelcomeWords } from '@repo/languages'
import { supabase } from '@repo/supabase'

export * from '@repo/supabase/word'

export interface TimelineWord {
    id: string
    word: string
    lang: Lang
    lib: string
    createdAt: string
}

export async function getTimelineWords({
    userId,
    limit,
    cursor,
}: {
    userId: string
    limit: number
    cursor?: string
}): Promise<TimelineWord[]> {
    let query = supabase
        .from('lexicon')
        .select('word, id, created_at, lib:libraries!inner(id, lang)')
        .not('word', 'in', `(${Object.values(languageWelcomeWords).join(',')})`)
        .eq('lib.owner', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

    if (cursor) {
        query = query.lt('created_at', cursor)
    }

    const { data } = await query.throwOnError()

    return data.flatMap(row => {
        if (!row.created_at) {
            return []
        }

        return [
            {
                id: row.id,
                word: row.word,
                lang: row.lib.lang as Lang,
                lib: row.lib.id,
                createdAt: row.created_at,
            },
        ]
    })
}
