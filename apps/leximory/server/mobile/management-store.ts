import 'server-only'
import { randomUUID } from 'node:crypto'
import { redis } from '@repo/kv/redis'
import { changeEbookFile } from './ebook-file-change'
import { ebookFiles } from './ebook-storage'
import { supabase } from '@repo/supabase'
import { revalidateTag } from 'next/cache'
import { editTextRecord } from './text-edit-store'
import { MobileError } from './errors'
import type { ManagementStore } from './management'

function expireText(library: string) {
    revalidateTag(`texts:${library}`, { expire: 0 })
}
async function resetLocations(id: string) {
    await supabase.from('reads').update({ location: null }).eq('text', id).throwOnError()
    // Keep the user's excerpts, but discard locations from the previous file.
    await supabase.from('bookmarks').update({ location: null }).eq('text', id).throwOnError()
}
async function withTextMutation<T>(id: string, operation: () => Promise<T>): Promise<T> {
    const key = `mobile:text-mutation:${id}`
    const token = randomUUID()
    if (!(await redis.set(key, token, { nx: true, ex: 120 }))) throw new MobileError('service_unavailable')
    try {
        return await operation()
    } finally {
        await redis.eval(
            "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) end return 0",
            [key],
            [token],
        )
    }
}
const operations: ManagementStore = {
    async edit(text, fields) {
        const updated = await editTextRecord({ database: supabase, text, fields })
        expireText(text.lib!)
        return updated
    },
    async remove(text) {
        const removeRecord = async () => {
            await supabase
                .from('texts')
                .delete()
                .eq('id', text.id)
                .eq('lib', text.lib!)
                .is('bookmark_url', null)
                .throwOnError()
        }
        if (text.has_ebook) await changeEbookFile(ebookFiles(supabase, text.id), null, removeRecord)
        else await removeRecord()
        expireText(text.lib!)
    },
    async replaceEbook(text, file) {
        await changeEbookFile(
            ebookFiles(supabase, text.id),
            { extension: file.type === 'application/pdf' ? 'pdf' : 'epub', file },
            async () => {
                await resetLocations(text.id)
                await supabase
                    .from('texts')
                    .update({ has_ebook: true })
                    .eq('id', text.id)
                    .eq('lib', text.lib!)
                    .is('bookmark_url', null)
                    .select('id')
                    .single()
                    .throwOnError()
            },
        )
        expireText(text.lib!)
    },
    async removeEbook(text) {
        await changeEbookFile(ebookFiles(supabase, text.id), null, async () => {
            await resetLocations(text.id)
            await supabase
                .from('texts')
                .update({ has_ebook: false })
                .eq('id', text.id)
                .eq('lib', text.lib!)
                .is('bookmark_url', null)
                .select('id')
                .single()
                .throwOnError()
        })
        expireText(text.lib!)
    },
    async removeWord(id, library) {
        await supabase.from('lexicon').delete().eq('id', id).eq('lib', library).throwOnError()
        revalidateTag(`words:${library}`, { expire: 0 })
        revalidateTag('words', { expire: 0 })
        revalidateTag(id, { expire: 0 })
    },
}
export const managementStore: ManagementStore = {
    edit: (text, fields) => withTextMutation(text.id, () => operations.edit(text, fields)),
    remove: (text) => withTextMutation(text.id, () => operations.remove(text)),
    replaceEbook: (text, file) => withTextMutation(text.id, () => operations.replaceEbook(text, file)),
    removeEbook: (text) => withTextMutation(text.id, () => operations.removeEbook(text)),
    removeWord: operations.removeWord,
}
