import 'server-only'
import type { supabase } from '@repo/supabase'
import { MOBILE_EBOOK_MAX_BYTES } from '@repo/env/content'
import { ExternalServiceError } from '../errors/external-service'
import { ebookStorageError } from './ebook-storage'
import { mobileMutationID } from './vocabulary-save'

export const ebookStagingBucket = 'mobile-ebook-uploads'
export const ebookStagingPrefix = (userId: string) => mobileMutationID('ebook-staging', userId) + '--'
export const ebookUploadWindowKey = (userId: string) => `user:${userId}:ebook-upload-window`
// Supabase signs upload tokens for two hours. Allow for issuance and in-flight requests at expiry.
export const signedEbookUploadLifetime = (2 * 3600 + 120) * 1000

export async function requireEbookStagingBucket(storage: typeof supabase.storage) {
    const { data, error } = await storage.getBucket(ebookStagingBucket)
    if (error) throw ebookStorageError(error, 'BUCKET_NOT_FOUND')
    if (
        data.public !== false ||
        data.file_size_limit !== MOBILE_EBOOK_MAX_BYTES ||
        !['application/pdf', 'application/epub+zip'].every((mime) => data.allowed_mime_types?.includes(mime))
    ) {
        throw new ExternalServiceError('supabase-storage', 'INVALID_STAGING_BUCKET_SETTINGS', false, null)
    }
}

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
