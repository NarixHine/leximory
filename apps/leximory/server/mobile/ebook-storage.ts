import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ebookVersionPrefix } from './ebook-source'
import type { EbookFiles } from './ebook-file-change'
import { z } from 'zod'

const storageFailure = z.object({
    status: z.number().optional(),
    statusCode: z.union([z.string(), z.number()]).optional(),
    code: z.string().optional(),
    error: z.string().optional(),
    message: z.string().optional(),
})

export async function isMissingObject(error: unknown): Promise<boolean> {
    // Binary downloads wrap the raw Response in StorageUnknownError.
    let payload = error
    let status: number | undefined
    if (
        typeof error === 'object' &&
        error !== null &&
        'originalError' in error &&
        error.originalError instanceof Response
    ) {
        status = error.originalError.status
        if (status === 404) return true
        if (status !== 400) return false
        payload = await error.originalError
            .clone()
            .json()
            .catch(() => null)
    }
    const parsed = storageFailure.safeParse(payload)
    if (!parsed.success) return false
    const failure = parsed.data
    status ??= failure.status ?? Number(failure.statusCode)
    if (status === 404) return true
    return (
        status === 400 &&
        (failure.code === 'NoSuchKey' ||
            failure.error === 'not_found' ||
            failure.message === 'Object not found' ||
            failure.message === 'The resource was not found')
    )
}

export function ebookFiles(database: Pick<SupabaseClient, 'storage'>, id: string): EbookFiles {
    const bucket = database.storage.from('user-files')
    return {
        async read(extension) {
            const { data, error } = await bucket.download(`ebooks/${id}.${extension}`)
            if (error) {
                if (await isMissingObject(error)) return null
                throw error
            }
            return data
        },
        async write(extension, file) {
            const { error } = await bucket.upload(`ebooks/${id}.${extension}`, file, {
                contentType: extension === 'pdf' ? 'application/pdf' : 'application/epub+zip',
                upsert: true,
                cacheControl: '0',
            })
            if (error) throw error
        },
        async remove(extension) {
            const { error } = await bucket.remove([`ebooks/${id}.${extension}`])
            if (error) throw error
        },
    }
}

export async function listEbookVersions(database: Pick<SupabaseClient, 'storage'>, id: string) {
    const bucket = database.storage.from('user-files')
    const search = ebookVersionPrefix(id)
    const paths: string[] = []
    for (let offset = 0; ; offset += 1000) {
        const { data, error } = await bucket.list('ebooks', {
            search,
            limit: 1000,
            offset,
            sortBy: { column: 'name', order: 'asc' },
        })
        if (error) throw error
        for (const entry of data) if (entry.id && entry.name.startsWith(search)) paths.push('ebooks/' + entry.name)
        if (data.length < 1000) return paths
    }
}
