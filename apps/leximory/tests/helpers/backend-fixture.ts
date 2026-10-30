import { createServer } from 'node:http'
import { z } from 'zod'

const userId = '11111111-1111-4111-8111-111111111111'
const row = z.object({ id: z.string(), lib: z.string(), title: z.string(), content: z.string() })
const folderRow = z.object({
    id: z.string(),
    name: z.string(),
    lang: z.literal('en'),
    owner: z.literal(userId),
    access: z.literal(0),
    shadow: z.literal(false),
})

// Only external HTTP services are replaced. Production routes, auth, stores, quota and queue SDKs stay intact.
export async function startBackendFixture() {
    const texts = new Map<string, z.infer<typeof row>>()
    const folders = new Map<string, z.infer<typeof folderRow> & { starred_by: null }>()
    const words = new Map<string, string>()
    const values = new Map<string, unknown>()
    const events: { id: string; name: string; data: unknown; environment: string | undefined }[] = []
    const requests: string[] = []
    let profile: { archived_libs: string[] | null; lexicoin: number } | null = null
    let profileUnavailable = false
    let rejection: { status: number; error: string } | null = null
    const server = createServer(async (request, response) => {
        const url = new URL(request.url ?? '/', 'http://fixture.test')
        const chunks: Buffer[] = []
        for await (const chunk of request) chunks.push(Buffer.from(chunk))
        const bytes = Buffer.concat(chunks).toString('utf8')
        const body: unknown = bytes ? JSON.parse(bytes) : null
        requests.push(`${request.method} ${url.pathname}`)
        function json(value: unknown, status = 200) {
            response.writeHead(status, { 'content-type': 'application/json' })
            response.end(JSON.stringify(value))
        }
        try {
            if (url.pathname === '/supabase/auth/v1/user') {
                json({
                    id: userId,
                    aud: 'authenticated',
                    role: 'authenticated',
                    email: 'fixture@example.invalid',
                    app_metadata: {},
                    user_metadata: {},
                    created_at: '2026-01-01T00:00:00Z',
                })
                return
            }
            if (url.pathname === '/supabase/rest/v1/libraries') {
                if (request.method === 'POST') {
                    if (!profile) {
                        json({ code: '23503', message: 'The library owner has no account profile' }, 409)
                        return
                    }
                    const folder = folderRow.parse(body)
                    if (!folders.has(folder.id)) folders.set(folder.id, { ...folder, starred_by: null })
                    response.writeHead(201)
                    response.end()
                    return
                }
                const id = url.searchParams.get('id')?.replace(/^eq\./, '')
                json(id ? (folders.get(id) ?? null) : [...folders.values()])
                return
            }
            if (url.pathname === '/supabase/rest/v1/lexicon' && request.method === 'POST') {
                const word = z.object({ id: z.string(), lib: z.string(), word: z.string() }).parse(body)
                if (!folders.has(word.lib)) {
                    json({ code: '23503', message: 'The welcome word has no folder' }, 409)
                    return
                }
                if (!words.has(word.id)) words.set(word.id, word.word)
                response.writeHead(201)
                response.end()
                return
            }
            if (url.pathname === '/supabase/rest/v1/users') {
                if (request.method === 'POST') {
                    if (profileUnavailable) {
                        json({ code: '08006', message: 'Fixture account storage unavailable' }, 503)
                        return
                    }
                    const account = z.object({ id: z.literal(userId), lexicoin: z.literal(20) }).parse(body)
                    if (!String(request.headers.prefer).includes('resolution=ignore-duplicates'))
                        throw new Error('Account initialization must never overwrite an existing balance or plan')
                    profile ??= { archived_libs: null, lexicoin: account.lexicoin }
                    response.writeHead(201)
                    response.end()
                    return
                }
                if (request.method === 'PATCH') {
                    const updated = z.object({ archived_libs: z.array(z.string()) }).parse(body)
                    if (!profile) throw new Error('The archive write requires an existing fixture profile')
                    const expected =
                        profile.archived_libs === null
                            ? 'is.null'
                            : 'eq.{' + profile.archived_libs.map((id) => JSON.stringify(id)).join(',') + '}'
                    if (url.searchParams.get('archived_libs') !== expected)
                        throw new Error('The archive write omitted its concurrency condition')
                    profile = { ...profile, ...updated }
                    json([{ id: userId }])
                    return
                }
                if (url.searchParams.get('select') === 'archived_libs') {
                    json(profile)
                    return
                }
                json(profile ? [{ id: userId, plan: 'beginner' }] : [])
                return
            }
            if (url.pathname === '/supabase/rest/v1/apple_subscriptions') {
                json([])
                return
            }
            if (url.pathname === '/supabase/rest/v1/texts') {
                if (request.method === 'POST') {
                    const text = row.parse(body)
                    if (!texts.has(text.id)) texts.set(text.id, text)
                    response.writeHead(201)
                    response.end()
                    return
                }
                const text = texts.get((url.searchParams.get('id') ?? '').replace(/^eq\./, ''))
                json(
                    text
                        ? {
                              ...text,
                              topics: null,
                              emoji: null,
                              has_ebook: false,
                              bookmark_url: null,
                              created_at: '2026-01-01T00:00:00Z',
                              updated_at: null,
                              no: null,
                          }
                        : null,
                )
                return
            }
            function redis(raw: unknown): unknown {
                const command = z.array(z.unknown()).parse(raw)
                const name = String(command[0]).toLowerCase()
                const key = String(command[1])
                if (name === 'get') return values.get(key) ?? null
                if (name === 'set') {
                    values.set(key, command[2])
                    return 'OK'
                }
                if (name === 'ttl') return 1000
                if (name === 'ping') return 'PONG'
                if (name === 'eval') {
                    const count = Number(command[2])
                    const keys = command.slice(3, 3 + count).map(String)
                    const cost = Number(command[3 + count])
                    const limit = Number(command[4 + count])
                    if (keys[1] && values.has(keys[1])) return 2
                    const used = Number(values.get(keys[0]!) ?? 0)
                    if (used + cost > limit) return 0
                    values.set(keys[0]!, used + cost)
                    if (keys[1]) values.set(keys[1], '1')
                    return 1
                }
                throw new Error('Unexpected fixture Redis command: ' + name)
            }
            if (url.pathname.startsWith('/redis')) {
                if (url.pathname.endsWith('/pipeline'))
                    json(
                        z
                            .array(z.unknown())
                            .parse(body)
                            .map((command) => ({ result: redis(command) })),
                    )
                else json({ result: redis(body) })
                return
            }
            if (url.pathname.startsWith('/inngest/e/')) {
                const batch = z.array(z.object({ id: z.string(), name: z.string(), data: z.unknown() })).parse(body)
                if (rejection) {
                    json({ status: rejection.status, error: rejection.error }, rejection.status)
                    return
                }
                for (const event of batch)
                    events.push({
                        ...event,
                        environment:
                            typeof request.headers['x-inngest-env'] === 'string'
                                ? request.headers['x-inngest-env']
                                : undefined,
                    })
                json({ status: 200, ids: batch.map((event) => event.id) })
                return
            }
            json({ error: 'Unexpected fixture request: ' + url.pathname }, 500)
        } catch (error) {
            json({ error: error instanceof Error ? error.message : 'fixture failure' }, 500)
        }
    })
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(0, '127.0.0.1', resolve)
    })
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('No fixture service port')
    const origin = `http://127.0.0.1:${address.port}`
    return {
        texts,
        events,
        requests,
        folders,
        words,
        balance: () => profile?.lexicoin,
        setBalance(value: number) {
            if (!profile) throw new Error('Fixture profile is absent')
            profile.lexicoin = value
        },
        rejectProfile(value: boolean) {
            profileUnavailable = value
        },
        archived: () => profile?.archived_libs ?? [],
        rejectQueue(value: { status: number; error: string } | null) {
            rejection = value
        },
        env: {
            VERCEL_ENV: 'development',
            VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
            SUPABASE_URL: origin + '/supabase',
            SUPABASE_SERVICE_ROLE_KEY: 'fixture-service-key',
            NEXT_PUBLIC_SUPABASE_URL: origin + '/supabase',
            NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon-key',
            UPSTASH_REDIS_REST_URL: origin + '/redis',
            UPSTASH_REDIS_REST_TOKEN: 'fixture-redis-token',
            INNGEST_DEV: '0',
            INNGEST_ENV: 'fixture-preview',
            INNGEST_BASE_URL: origin + '/inngest/',
            INNGEST_EVENT_KEY: 'fixture-event-key',
            INNGEST_SIGNING_KEY: 'signkey-test-' + 'a'.repeat(64),
            ELEVENLABS_API_KEY: 'fixture',
            VAPID_PRIVATE_KEY: 'fixture',
            CREEM_API_KEY: 'fixture',
            CREEM_WEBHOOK_SECRET: 'fixture',
            AI_GATEWAY_API_KEY: 'fixture',
            TABSTACK_API_KEY: 'fixture',
            QSTASH_URL: origin,
            QSTASH_TOKEN: 'fixture',
            QSTASH_CURRENT_SIGNING_KEY: 'fixture',
            QSTASH_NEXT_SIGNING_KEY: 'fixture',
            NEXT_PUBLIC_LEXIMORY_URL: origin,
            NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'fixture',
            NEXT_PUBLIC_SIGN_IN_URL: origin,
        },
        async close() {
            server.closeAllConnections()
            await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
        },
    }
}
