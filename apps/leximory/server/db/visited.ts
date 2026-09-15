import 'server-only'
import { supabase } from '@repo/supabase'
import { cacheTag } from 'next/cache'

export async function visitText({ textId, userId }: { textId: string; userId: string }) {
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

/**
 * Persists the reader's current position for a text, creating the read row when
 * the text was never visited (ebook texts with empty content never trigger
 * `visitText`). Updates in place rather than upserting so it stays safe without
 * a unique constraint on (uid, text).
 */
export async function saveLocation({
    textId,
    userId,
    location,
}: {
    textId: string
    userId: string
    location: string
}) {
    const { data: updated } = await supabase
        .from('reads')
        .update({ location, updated_at: new Date().toISOString() })
        .eq('text', textId)
        .eq('uid', userId)
        .select('id')

    if (!updated || updated.length === 0) {
        await supabase.from('reads').insert({ text: textId, uid: userId, location }).throwOnError()
    }
}

/** Returns the reader's last persisted position for a text, if any. */
export async function getLocation({
    textId,
    userId,
}: {
    textId: string
    userId: string
}): Promise<string | null> {
    const { data } = await supabase
        .from('reads')
        .select('location')
        .eq('text', textId)
        .eq('uid', userId)
        .limit(1)

    return data?.[0]?.location ?? null
}

export async function getVisitedTextIds({ libId, userId }: { libId: string; userId: string }) {
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
