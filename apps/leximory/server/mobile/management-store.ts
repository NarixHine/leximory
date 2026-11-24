import 'server-only'
import { MobileError } from './errors'
import { textRowSchema, type TextRow } from './catalog'
import { z } from 'zod'
import { checkedResponse } from './http'
import type { redis } from '@repo/kv/redis'
import { changeEbookFile } from './ebook-file-change'
import { ebookSourceKey, readEbookSource } from './ebook-source'
import { ebookFiles, listEbookVersions } from './ebook-storage'
import { createEbookPublication, type EbookReplacement } from './ebook-publication'
import { removePDFOutlineArtifacts } from './pdf-outline-cleanup'
import type { supabase } from '@repo/supabase'
import { invalidateMutationCaches, mutationEffects } from './mutation-effects'
import { withTextMutation } from './mutation-lease'
import { editTextRecord } from './text-edit-store'
import type { ManagementStore } from './management'

function expireText(library: string) {
    invalidateMutationCaches(`texts:${library}`)
}
export function createManagementStore({
    database,
    lease,
}: {
    database: Pick<typeof supabase, 'from' | 'storage'>
    lease: Pick<typeof redis, 'set' | 'eval' | 'scan' | 'get' | 'del'>
}) {
    const publication = createEbookPublication(database, lease)
    async function replaceEbook(text: TextRow, file: File, token: string, replacement?: EbookReplacement) {
        const { data } = await database.from('texts').select('*').eq('id', text.id).maybeSingle().throwOnError()
        const current = checkedResponse(textRowSchema.nullable(), data)
        if (!current || current.bookmark_url || current.lib !== text.lib || current.has_ebook !== text.has_ebook)
            throw new MobileError('stale_revision')
        const source = await publication.publish(current, file, token, replacement)
        if (!current.has_ebook) await publication.update(current, true)
        expireText(current.lib!)
        return source
    }
    async function detachVersionedBook(text: TextRow, versions: string[]) {
        if (text.has_ebook) await publication.update(text, false)
        const paths = [`ebooks/${text.id}.pdf`, `ebooks/${text.id}.epub`, ...versions]
        const bucket = database.storage.from('user-files')
        for (let offset = 0; offset < paths.length; offset += 100) {
            const result = await bucket.remove(paths.slice(offset, offset + 100))
            if (result.error) throw result.error
        }
    }
    const operations: Omit<ManagementStore, 'replaceEbook'> = {
        async edit(text, fields) {
            const updated = await editTextRecord({ database: database, text, fields })
            expireText(text.lib!)
            return updated
        },
        async remove(text) {
            const removeRecord = async () => {
                await removePDFOutlineArtifacts(database, lease, text.id)
                await publication.remove(text)
            }
            const versions = await listEbookVersions(database, text.id)
            if (versions.length || (await readEbookSource(lease, text.id))) {
                await detachVersionedBook(text, versions)
                await removeRecord()
                await mutationEffects.run({
                    name: 'ebook.cleanup',
                    run: async () => {
                        await lease.del(ebookSourceKey(text.id))
                    },
                })
            } else if (text.has_ebook) await changeEbookFile(ebookFiles(database, text.id), null, removeRecord)
            else await removeRecord()
            expireText(text.lib!)
        },
        async removeEbook(text) {
            const versions = await listEbookVersions(database, text.id)
            if (versions.length || (await readEbookSource(lease, text.id))) await detachVersionedBook(text, versions)
            else await changeEbookFile(ebookFiles(database, text.id), null, () => publication.update(text, false))
            expireText(text.lib!)
        },
        async removeWord(id, library) {
            await database.from('lexicon').delete().eq('id', id).eq('lib', library).throwOnError()
            invalidateMutationCaches(`words:${library}`)
            invalidateMutationCaches('words')
            invalidateMutationCaches(id)
        },
    }
    return {
        edit: (text: TextRow, fields: Parameters<ManagementStore['edit']>[1]) =>
            withTextMutation(lease, text.id, () => operations.edit(text, fields)),
        remove: (text: TextRow) => withTextMutation(lease, text.id, () => operations.remove(text)),
        replaceEbook: (text: TextRow, file: File, staged?: EbookReplacement) =>
            withTextMutation(lease, text.id, (token) => replaceEbook(text, file, token, staged)),
        removeEbook: (text: TextRow) => withTextMutation(lease, text.id, () => operations.removeEbook(text)),
        removeWord: operations.removeWord,
    }
}
