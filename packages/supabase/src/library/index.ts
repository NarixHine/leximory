import 'server-only'
import { Lang } from '@repo/env/config'
import { supabase } from '@repo/supabase'
import { ensureUserExists } from '../user'
import { getLanguageName } from '@repo/languages'

export async function getShadowLib({ owner, lang }: { owner: string, lang: Lang }) {
    const { data: rec } = await supabase
        .from('libraries')
        .select('*')
        .eq('owner', owner)
        .eq('shadow', true)
        .eq('lang', lang)
        .single()

    if (rec) {
        return rec
    }

    await ensureUserExists(owner)
    const { data: lib } = await supabase
        .from('libraries')
        .insert({
            owner,
            shadow: true,
            name: `🗃️ ${getLanguageName(lang)}词汇仓库`,
            lang,
        })
        .select()
        .single()

    return lib!
}
