import 'server-only'
import { createHash } from 'node:crypto'
import { nanoid } from 'nanoid'
import type { redis } from '@repo/kv/redis'
import type { supabase } from '@repo/supabase'
import type { AuthoringStore } from './authoring'
import { summarizeText, textRowSchema } from './catalog'
import { ebookFiles } from './ebook-storage'
import { MobileError, mobileDependency } from './errors'
import { checkedResponse } from './http'
import { withTextMutation } from './mutation-lease'
import { mobileMutationID } from './vocabulary-save'

export function createEbookImporter({
    database,
    lease,
}: {
    database: Pick<typeof supabase, 'from' | 'storage'>
    lease: Pick<typeof redis, 'set' | 'eval'>
}): AuthoringStore['ebook'] {
    return async (library, { title, upload, requestId }) => {
        const { file, extension } = upload
        const id = requestId
            ? mobileMutationID(
                  'ebook-import',
                  library.owner,
                  library.id,
                  requestId,
                  title,
                  extension,
                  createHash('sha256')
                      .update(new Uint8Array(await file.arrayBuffer()))
                      .digest('hex'),
              )
            : nanoid()

        return withTextMutation(lease, id, async () => {
            const { data } = await mobileDependency('ebook.lookup', () =>
                database.from('texts').select('*').eq('id', id).maybeSingle().throwOnError(),
            )
            if (data) {
                const existing = checkedResponse(textRowSchema, data)
                if (existing.id !== id || existing.lib !== library.id || !existing.has_ebook || existing.bookmark_url)
                    throw new MobileError('inaccessible')
                return { text: summarizeText(existing), created: false }
            }

            // Publish the catalog row only once its file is available. A retry uses the same row and object key.
            const files = ebookFiles(database, id)
            await mobileDependency('ebook.upload', () => files.write(extension, file))
            const { data: saved } = await mobileDependency('ebook.publish', () =>
                database
                    .from('texts')
                    .insert({ id, lib: library.id, title, content: '', has_ebook: true, bookmark_url: null })
                    .select('*')
                    .single()
                    .throwOnError(),
            )
            return { text: summarizeText(checkedResponse(textRowSchema, saved)), created: true }
        })
    }
}
