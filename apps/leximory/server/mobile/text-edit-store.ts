import 'server-only'
import type { supabase } from '@repo/supabase'
import type { TextRow } from './catalog'
import { textRowSchema } from './catalog'
import { checkedResponse } from './http'
import { MobileError } from './errors'
import type { ManagementStore } from './management'

function postgresTextArray(values: string[]): string {
    return `{${values.map((value) => `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`).join(',')}}`
}

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
        .update(fields)
        .eq('id', text.id)
        .eq('lib', text.lib!)
        .is('bookmark_url', null)
        .eq('content', text.content)
        .eq('title', text.title)
        .eq('has_ebook', text.has_ebook)
    write = text.emoji === null ? write.is('emoji', null) : write.eq('emoji', text.emoji)
    write =
        text.topics === null ? write.is('topics', null) : write.filter('topics', 'eq', postgresTextArray(text.topics))
    const { data } = await write.select('*').maybeSingle().throwOnError()
    if (!data) throw new MobileError('stale_revision')
    return checkedResponse(textRowSchema, data)
}
