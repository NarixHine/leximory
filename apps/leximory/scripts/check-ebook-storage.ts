import { createClient } from '@supabase/supabase-js'
import { MOBILE_EBOOK_MAX_BYTES } from '@repo/env/content'
import { ExternalServiceError } from '../server/errors/external-service'
import {
    EbookBucketSettingsError,
    ebookStagingBucket,
    ebookStagingBucketOptions,
    requireEbookStagingBucket,
} from '../server/mobile/ebook-staging-lifecycle'
import { ebookStorageError } from '../server/mobile/ebook-storage'

const destination = 'user-files'

async function check() {
    const [mode, extra] = process.argv.slice(2)
    if (extra !== undefined || (mode !== undefined && mode !== '--deployment' && mode !== '--apply')) {
        throw new ExternalServiceError('supabase-storage', 'INVALID_STORAGE_CHECK_ARGUMENTS', false, null)
    }
    if (mode === '--deployment' && process.env.VERCEL !== '1' && !process.env.VERCEL_ENV) return

    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        throw new ExternalServiceError('supabase-storage', 'MISSING_SUPABASE_CONFIGURATION', false, null)
    }
    const { storage } = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }) },
    })

    const staging = await requireEbookStagingBucket(storage).catch((error: unknown) => {
        if (mode === '--apply' && error instanceof ExternalServiceError) {
            if (error.code === 'BUCKET_NOT_FOUND') return 'missing' as const
            if (error instanceof EbookBucketSettingsError) return 'invalid' as const
        }
        throw error
    })
    if (
        mode === '--apply' &&
        (typeof staging === 'string' || staging.file_size_limit !== ebookStagingBucketOptions.fileSizeLimit)
    ) {
        const result =
            staging === 'missing'
                ? await storage.createBucket(ebookStagingBucket, ebookStagingBucketOptions)
                : await storage.updateBucket(ebookStagingBucket, ebookStagingBucketOptions)
        if (result.error) throw ebookStorageError(result.error)
        const current = await requireEbookStagingBucket(storage)
        if (current.file_size_limit !== ebookStagingBucketOptions.fileSizeLimit) {
            throw new EbookBucketSettingsError(ebookStagingBucket, ['The exact byte limit was not saved'])
        }
    }

    const { data: bucket, error } = await storage.getBucket(destination)
    if (error) {
        const failure = ebookStorageError(error, 'EBOOK_DESTINATION_NOT_FOUND')
        throw new EbookBucketSettingsError(destination, [failure.code])
    }
    const issues: string[] = []
    if (bucket.public !== false) issues.push('Turn off Public bucket')
    if (bucket.file_size_limit != null && bucket.file_size_limit < MOBILE_EBOOK_MAX_BYTES) {
        issues.push(`Allow at least 15 MB (current limit ${bucket.file_size_limit} bytes)`)
    }
    const allowed = bucket.allowed_mime_types
    if (
        allowed &&
        !ebookStagingBucketOptions.allowedMimeTypes.every(
            (mime) => allowed.includes(mime) || allowed.includes('application/*') || allowed.includes('*/*'),
        )
    ) {
        issues.push('Allow application/pdf and application/epub+zip')
    }
    if (issues.length) throw new EbookBucketSettingsError(destination, issues)
    console.info(JSON.stringify({ status: 'ready', buckets: [ebookStagingBucket, destination] }))
}

check().catch((error: unknown) => {
    console.error(
        JSON.stringify({
            status: 'not_ready',
            bucket: error instanceof EbookBucketSettingsError ? error.bucket : ebookStagingBucket,
            ...(error instanceof ExternalServiceError
                ? { code: error.code, upstreamStatus: error.status }
                : { code: 'STORAGE_CHECK_FAILED' }),
            ...(error instanceof EbookBucketSettingsError ? { issues: error.issues } : {}),
        }),
    )
    process.exitCode = 1
})
