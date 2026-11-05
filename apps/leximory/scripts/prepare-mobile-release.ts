import { randomUUID, randomBytes } from 'node:crypto'
import { readFile, open } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'
import { createClient } from '@supabase/supabase-js'
import { librarySchema } from '@repo/api'
import { z } from 'zod'

// Provisioning is separate from verification. The default command only prints a plan.
async function main() {
    const args = process.argv.slice(2)
    if (args.length > 1 || (args.length === 1 && !['--apply', '--resume'].includes(args[0] ?? '')))
        throw Error('Use no arguments to inspect the plan, --apply to create fixtures, or --resume to recover them')
    const resuming = args[0] === '--resume'
    const connection = z
        .object({ apiURL: z.url(), supabaseURL: z.url(), anonKey: z.string().min(1) })
        .parse(
            JSON.parse(
                await readFile(new URL('../../leximory-ios/App/Resources/Connection.json', import.meta.url), 'utf8'),
            ),
        )
    if (new URL(connection.apiURL).protocol !== 'https:' || new URL(connection.supabaseURL).protocol !== 'https:')
        throw Error('Fixture provisioning requires HTTPS origins')
    const target = new URL('../.env.backend-e2e.local', import.meta.url)
    if (!args.length) {
        console.info(
            JSON.stringify(
                {
                    status: 'plan_only',
                    origin: new URL(connection.apiURL).origin,
                    supabaseOrigin: new URL(connection.supabaseURL).origin,
                    creates: [
                        'one isolated auth user marked backend_e2e',
                        'one private English verification folder with its welcome word',
                    ],
                    credentialsFile: fileURLToPath(target),
                    verification: 'one real annotated import per run, replay, archive round trip and article cleanup',
                    quotaCostPerRun: 1,
                    retains: 'isolated account and folder for subsequent CI runs',
                },
                null,
                2,
            ),
        )
        return
    }
    process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)))
    const settings = z
        .object({ SUPABASE_URL: z.url(), SUPABASE_SERVICE_ROLE_KEY: z.string().min(1) })
        .parse(process.env)
    if (new URL(settings.SUPABASE_URL).origin !== new URL(connection.supabaseURL).origin)
        throw Error('The bundled app and provisioning credentials target different databases')
    const entries: Record<string, string> = resuming
        ? z.record(z.string(), z.string()).parse(parseEnv(await readFile(target, 'utf8')))
        : {
              BACKEND_E2E_ORIGIN: new URL(connection.apiURL).origin,
              BACKEND_E2E_SUPABASE_URL: connection.supabaseURL,
              BACKEND_E2E_ANON_KEY: connection.anonKey,
              BACKEND_E2E_EMAIL: `leximory-ci-${randomUUID()}@example.invalid`,
              BACKEND_E2E_PASSWORD: randomBytes(32).toString('base64url'),
              BACKEND_E2E_ALLOW_WRITES: 'true',
              BACKEND_E2E_FOLDER_REQUEST_ID: randomUUID(),
          }
    const saved = z
        .object({
            BACKEND_E2E_ORIGIN: z.literal(new URL(connection.apiURL).origin),
            BACKEND_E2E_SUPABASE_URL: z.literal(connection.supabaseURL),
            BACKEND_E2E_ANON_KEY: z.literal(connection.anonKey),
            BACKEND_E2E_EMAIL: z.string().regex(/^leximory-ci-[a-f0-9-]+@example\.invalid$/),
            BACKEND_E2E_PASSWORD: z.string().min(32),
            BACKEND_E2E_FOLDER_REQUEST_ID: z.uuid(),
            BACKEND_E2E_USER_ID: z.uuid().optional(),
        })
        .parse(entries)
    const email = saved.BACKEND_E2E_EMAIL
    const password = saved.BACKEND_E2E_PASSWORD
    const requestId = saved.BACKEND_E2E_FOLDER_REQUEST_ID
    const output = await open(target, resuming ? 'r+' : 'wx', 0o600)
    async function save() {
        const bytes = Buffer.from(
            Object.entries(entries)
                .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
                .join('\n') + '\n',
        )
        await output.write(bytes, 0, bytes.length, 0)
        await output.truncate(bytes.length)
        await output.sync()
    }
    try {
        // Persist recovery credentials before the first remote write can lose its acknowledgement.
        await save()
        if (!resuming) {
            const admin = createClient(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY, {
                auth: { persistSession: false, autoRefreshToken: false },
            })
            const created = await admin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                app_metadata: { backend_e2e: true },
            })
            if (created.error || !created.data.user) throw Error('Creating the isolated auth fixture failed')
            entries.BACKEND_E2E_USER_ID = created.data.user.id
            await save()
        }
        const auth = createClient(connection.supabaseURL, connection.anonKey, {
            auth: { persistSession: false, autoRefreshToken: false },
        })
        const signedIn = await auth.auth.signInWithPassword({ email, password })
        if (signedIn.error || !signedIn.data.session)
            throw Error('Signing in the newly created fixture failed; its credentials were retained')
        const user = signedIn.data.user
        if (
            user.app_metadata.backend_e2e !== true ||
            user.email !== email ||
            (saved.BACKEND_E2E_USER_ID && user.id !== saved.BACKEND_E2E_USER_ID)
        )
            throw Error('Refusing fixture writes outside the designated isolated account')
        entries.BACKEND_E2E_USER_ID = user.id
        await save()
        const response = await fetch(new URL('/api/mobile/v1/libraries', connection.apiURL), {
            method: 'POST',
            redirect: 'error',
            signal: AbortSignal.timeout(60000),
            headers: {
                authorization: 'Bearer ' + signedIn.data.session.access_token,
                'content-type': 'application/json',
            },
            body: JSON.stringify({ name: '__leximory_e2e__Reading', language: 'en', requestId }),
        })
        if (!response.ok)
            throw Error(
                `Creating the fixture folder failed with HTTP ${response.status}; credentials and its retry identity were retained`,
            )
        const library = librarySchema.parse(await response.json())
        entries.BACKEND_E2E_LIBRARY_ID = library.id
        await save()
        console.info(JSON.stringify({ status: 'prepared', credentialsFile: fileURLToPath(target) }))
    } finally {
        await output.close()
    }
}
main().catch((error) => {
    console.error(
        JSON.stringify({
            status: 'not_prepared',
            reason:
                error instanceof z.ZodError
                    ? 'Required provisioning configuration is invalid'
                    : error instanceof Error
                      ? error.message
                      : 'Fixture creation failed',
        }),
    )
    process.exitCode = 1
})
