import { createClient } from '@supabase/supabase-js'
import { ExternalServiceError } from '../server/errors/external-service'
import { ebookStagingBucket, requireEbookStagingBucket } from '../server/mobile/ebook-staging-lifecycle'

async function check() {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        throw new ExternalServiceError('supabase-storage', 'MISSING_SUPABASE_CONFIGURATION', false, null)
    }
    const { storage } = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
    })
    await requireEbookStagingBucket(storage)
    console.info(JSON.stringify({ status: 'ready', bucket: ebookStagingBucket }))
}

check().catch((error: unknown) => {
    console.error(
        JSON.stringify({
            status: 'not_ready',
            bucket: ebookStagingBucket,
            ...(error instanceof ExternalServiceError
                ? { code: error.code, upstreamStatus: error.status }
                : { code: 'STORAGE_CHECK_FAILED' }),
        }),
    )
    process.exitCode = 1
})
