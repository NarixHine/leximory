import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import env from '@repo/env'

// Read-only dependency census. Never signs in, reads account rows, writes data, or sends jobs.
async function main() {
    const connection = z
        .object({ apiURL: z.url() })
        .parse(
            JSON.parse(
                await readFile(new URL('../../leximory-ios/App/Resources/Connection.json', import.meta.url), 'utf8'),
            ),
        )
    const origin = new URL(connection.apiURL).origin
    async function probe(name: string, action: () => Promise<unknown>) {
        try {
            return { name, result: await action() }
        } catch (error) {
            const parsed = z
                .object({ name: z.string(), cause: z.object({ code: z.string() }).optional() })
                .safeParse(error)
            return {
                name,
                error: parsed.success ? { type: parsed.data.name, code: parsed.data.cause?.code } : 'unavailable',
            }
        }
    }
    const options = { redirect: 'manual' as const, signal: AbortSignal.timeout(15000) }
    const results = await Promise.all([
        probe('mobile_http', async () => {
            const response = await fetch(origin + '/api/mobile/v1/me', options)
            const type = response.headers.get('content-type')
            const body = type?.includes('application/json') ? await response.json() : null
            const failure = z.object({ error: z.object({ code: z.string() }) }).safeParse(body)
            return {
                status: response.status,
                contentType: type,
                code: failure.success ? failure.data.error.code : null,
                requestId: response.headers.get('x-leximory-request-id'),
                vercelProtection: response.headers.has('x-vercel-mitigated'),
            }
        }),
        probe('annotation_runtime', async () => {
            const response = await fetch(origin + '/api/inngest', options)
            const type = response.headers.get('content-type')
            const info = z
                .object({
                    mode: z.string().optional(),
                    function_count: z.number().optional(),
                    has_event_key: z.boolean().optional(),
                    has_signing_key: z.boolean().optional(),
                    schema_version: z.string().optional(),
                })
                .safeParse(type?.includes('application/json') ? await response.json() : null)
            return { status: response.status, contentType: type, info: info.success ? info.data : null }
        }),
        probe('database_schema', async () => {
            const response = await fetch(env.SUPABASE_URL + '/rest/v1/', {
                ...options,
                headers: {
                    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
                    authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
                },
            })
            if (!response.ok) return { status: response.status }
            const spec = z
                .object({
                    definitions: z.record(
                        z.string(),
                        z.object({
                            properties: z.record(z.string(), z.unknown()).optional(),
                        }),
                    ),
                })
                .parse(await response.json())
            return {
                status: response.status,
                tables: Object.fromEntries(
                    ['libraries', 'texts', 'users', 'apple_subscriptions'].map((name) => [
                        name,
                        Boolean(spec.definitions[name]),
                    ]),
                ),
                textColumns: Object.keys(spec.definitions.texts?.properties ?? {}),
            }
        }),
        probe('quota_store', async () => {
            const response = await fetch(env.UPSTASH_REDIS_REST_URL, {
                ...options,
                method: 'POST',
                headers: {
                    authorization: 'Bearer ' + env.UPSTASH_REDIS_REST_TOKEN,
                    'content-type': 'application/json',
                },
                body: JSON.stringify(['PING']),
            })
            const pong = z.object({ result: z.literal('PONG') }).safeParse(await response.json())
            return { status: response.status, healthy: pong.success }
        }),
    ])
    console.info(JSON.stringify({ origin, results }, null, 2))
}
main().catch(() => {
    console.error('Backend diagnostic could not start')
    process.exitCode = 1
})
