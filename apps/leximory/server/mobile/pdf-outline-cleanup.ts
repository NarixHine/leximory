import 'server-only'
import { z } from 'zod'
import type { supabase } from '@repo/supabase'
import type { redis } from '@repo/kv/redis'

const fileSchema = z.object({ path: z.string() })
const publicationSchema = z.union([fileSchema, z.object({ before: fileSchema, after: fileSchema })])

// Called under the same text lease as outline publication, while ownership still exists.
export async function removePDFOutlineArtifacts(
    database: Pick<typeof supabase, 'storage'>,
    state: Pick<typeof redis, 'scan' | 'get' | 'del'>,
    textId: string,
): Promise<void> {
    const bucket = database.storage.from('user-files')
    const prefix = `pdf-outlines/${textId}/`
    const files: string[] = []
    async function list(directory: string): Promise<void> {
        for (let offset = 0; ; offset += 1000) {
            const { data, error } = await bucket.list(directory, {
                limit: 1000,
                offset,
                sortBy: { column: 'name', order: 'asc' },
            })
            if (error) throw error
            for (const entry of data) {
                const path = `${directory}/${entry.name}`
                if (entry.id) files.push(path)
                else await list(path)
            }
            if (data.length < 1000) return
        }
    }
    await list(`pdf-outlines/${textId}`)
    // Legacy publication keys hash their scope. As in account deletion, match their
    // stored paths so all source versions are removed without touching another text.
    for (const pattern of ['mobile:pdf-outline:*', 'mobile:pdf-outline-receipt:*']) {
        let cursor = 0
        do {
            const [next, keys] = await state.scan(cursor, { match: pattern, count: 100 })
            for (const key of keys) {
                const value = publicationSchema.safeParse(await state.get(key))
                if (!value.success) continue
                const paths = 'path' in value.data ? [value.data.path] : [value.data.before.path, value.data.after.path]
                if (paths.some((path) => path.startsWith(prefix) || path === `ebooks/${textId}.pdf`))
                    await state.del(key)
            }
            cursor = Number(next)
        } while (cursor !== 0)
    }
    // Invalidate publication before removing files, so partial cleanup falls back to
    // the original ebook. A failure leaves the text row available for retry/inventory.
    for (let offset = 0; offset < files.length; offset += 100) {
        const { error } = await bucket.remove(files.slice(offset, offset + 100))
        if (error) throw error
    }
}
