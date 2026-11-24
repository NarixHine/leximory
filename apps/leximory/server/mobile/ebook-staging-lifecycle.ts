import 'server-only'
import type { supabase } from '@repo/supabase'
import { mobileMutationID } from './vocabulary-save'

export const ebookStagingBucket = 'mobile-ebook-uploads'
export const ebookStagingPrefix = (userId: string) => mobileMutationID('ebook-staging', userId) + '--'
export const ebookUploadWindowKey = (userId: string) => `user:${userId}:ebook-upload-window`
// Supabase signs upload tokens for two hours. Allow for issuance and in-flight requests at expiry.
export const signedEbookUploadLifetime = (2 * 3600 + 120) * 1000

export async function removeAccountEbookStaging(database: Pick<typeof supabase, 'storage'>, userId: string) {
    const bucket = database.storage.from(ebookStagingBucket)
    const search = ebookStagingPrefix(userId)
    for (let offset = 0; ; ) {
        const { data, error } = await bucket.list('', {
            search,
            offset,
            limit: 100,
            sortBy: { column: 'name', order: 'asc' },
        })
        if (error) throw error
        const paths = data.filter((entry) => entry.id && entry.name.startsWith(search)).map((entry) => entry.name)
        if (paths.length) {
            const removed = await bucket.remove(paths)
            if (removed.error) throw removed.error
        }
        if (data.length < 100) return
        offset += data.length - paths.length
    }
}
