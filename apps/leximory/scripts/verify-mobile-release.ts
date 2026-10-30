import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { releaseConfigSchema, ReleaseVerificationError, verifyMobileRelease } from './lib/mobile-release'

async function main() {
    const parsed = releaseConfigSchema.safeParse({
        origin: process.env.BACKEND_E2E_ORIGIN,
        supabaseURL: process.env.BACKEND_E2E_SUPABASE_URL,
        anonKey: process.env.BACKEND_E2E_ANON_KEY,
        email: process.env.BACKEND_E2E_EMAIL,
        password: process.env.BACKEND_E2E_PASSWORD,
        userId: process.env.BACKEND_E2E_USER_ID,
        libraryId: process.env.BACKEND_E2E_LIBRARY_ID,
        allowWrites: process.env.BACKEND_E2E_ALLOW_WRITES,
        expectedRevision: process.env.BACKEND_E2E_EXPECTED_REVISION,
    })
    if (!parsed.success) {
        console.error(
            JSON.stringify({
                status: 'not_verified',
                phase: 'configuration',
                invalidSettings: parsed.error.issues.map((issue) => issue.path.join('.')),
            }),
        )
        process.exitCode = 1
        return
    }
    const config = parsed.data
    const auth = createClient(config.supabaseURL, config.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await auth.auth.signInWithPassword({ email: config.email, password: config.password })
    const fixture = z
        .object({ id: z.literal(config.userId), app_metadata: z.object({ backend_e2e: z.literal(true) }) })
        .safeParse(data.user)
    if (error || !data.session || !fixture.success)
        throw new ReleaseVerificationError(
            'account-isolation',
            'Refusing verification without a designated isolated test account',
        )
    console.info(
        JSON.stringify(
            await verifyMobileRelease({
                config,
                accessToken: data.session.access_token,
                progress: (phase) => console.info(JSON.stringify({ status: 'checking', phase })),
            }),
        ),
    )
}
main().catch((error) => {
    console.error(
        JSON.stringify(
            error instanceof ReleaseVerificationError
                ? { status: 'not_verified', phase: error.phase, reason: error.message, traceId: error.traceId }
                : {
                      status: 'not_verified',
                      phase: 'verification',
                      reason: 'Verification failed; no release success was recorded',
                  },
        ),
    )
    process.exitCode = 1
})
