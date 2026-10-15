import 'server-only'
import { supabase } from '@repo/supabase'
import { getLanguageName } from '@repo/languages'
import type { Lang } from '@repo/schema/library'
import type { MobileSubject } from '@repo/schema/mobile'
import { mobileMutationID } from './vocabulary-save'
import { MobileError } from './errors'

export async function shadowLibrary(subject: MobileSubject, language: Lang): Promise<string> {
    const { data: existing } = await supabase
        .from('libraries')
        .select('id')
        .eq('owner', subject.userId)
        .eq('lang', language)
        .eq('shadow', true)
        .order('id')
        .limit(1)
        .maybeSingle()
        .throwOnError()
    if (existing) return existing.id
    const id = mobileMutationID('shadow', subject.userId, language)
    await supabase
        .from('libraries')
        .upsert(
            {
                id,
                owner: subject.userId,
                lang: language,
                shadow: true,
                name: '🗃️ ' + getLanguageName(language) + '词汇仓库',
            },
            { onConflict: 'id', ignoreDuplicates: true },
        )
        .throwOnError()
    const { data } = await supabase
        .from('libraries')
        .select('id,owner,shadow,lang')
        .eq('id', id)
        .single()
        .throwOnError()
    if (data.owner !== subject.userId || !data.shadow || data.lang !== language) throw new MobileError('inaccessible')
    return data.id
}
