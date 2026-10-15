import 'server-only'
import type { supabase } from '@repo/supabase'
import type { TextRow } from './catalog'
import { textRowSchema } from './catalog'
import { checkedResponse } from './http'
import { MobileError } from './errors'
import type { ManagementStore } from './management'

export async function editTextRecord({
    database,
    text,
    fields,
}: {
    database: Pick<typeof supabase, 'from'>
    text: TextRow
    fields: Parameters<ManagementStore['edit']>[1]
}): Promise<TextRow> {
    let write = database
        .from('texts')
        .update({
            ...fields,
            updated_at: new Date(
                Math.max(Date.now(), text.updated_at ? Date.parse(text.updated_at) + 1 : 0),
            ).toISOString(),
        })
        .eq('id', text.id)
        .eq('lib', text.lib!)
        .is('bookmark_url', null)
        .eq('has_ebook', text.has_ebook)
    // Article bodies belong in the request body; putting them in a filter exceeds HTTP URL limits.
    write = text.updated_at === null ? write.is('updated_at', null) : write.eq('updated_at', text.updated_at)
    const { data } = await write.select('*').maybeSingle().throwOnError()
    if (!data) throw new MobileError('stale_revision')
    return checkedResponse(textRowSchema, data)
}
