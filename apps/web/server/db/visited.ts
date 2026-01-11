import 'server-only'
import { supabase } from '@repo/supabase'
import { cacheTag } from 'next/cache'

export async function visitText({ textId, userId }: { textId: string, userId: string }) {
    // find existing visit record
    const { data: existingVisit } = await supabase
        .from('reads')
        .select('text, uid')
        .eq('text', textId)
        .eq('uid', userId)
        .single()

    if (existingVisit) {
        return
    }

    await supabase
        .from('reads')
        .upsert({ text: textId, uid: userId })
        .select('text, texts (lib)')
        .single()
        .throwOnError()
}

export async function getVisitedTextIds({ libId, userId }: { libId: string, userId: string }) {
    'use cache'
    cacheTag(`reads:${libId}`)

    const { data } = await supabase
        .from('reads')
        .select('text, texts!inner(lib)')
        .eq('uid', userId)
        .eq('texts.lib', libId)
        .throwOnError()

    return data?.map(v => v.text) ?? []
}
