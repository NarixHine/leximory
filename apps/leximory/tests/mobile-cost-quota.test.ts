import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHash } from 'node:crypto'
import { z } from 'zod'

// Production SDKs use fake external HTTP services, never live credentials or accounts.
for (const key of [
    'ELEVENLABS_API_KEY',
    'UPSTASH_REDIS_REST_TOKEN',
    'VAPID_PRIVATE_KEY',
    'CREEM_API_KEY',
    'CREEM_WEBHOOK_SECRET',
    'SUPABASE_SERVICE_ROLE_KEY',
    'AI_GATEWAY_API_KEY',
    'TABSTACK_API_KEY',
    'QSTASH_TOKEN',
    'QSTASH_CURRENT_SIGNING_KEY',
    'QSTASH_NEXT_SIGNING_KEY',
    'INNGEST_EVENT_KEY',
    'INNGEST_SIGNING_KEY',
    'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
])
    process.env[key] = 'quota-fixture'
for (const key of [
    'SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'UPSTASH_REDIS_REST_URL',
    'QSTASH_URL',
    'NEXT_PUBLIC_LEXIMORY_URL',
    'NEXT_PUBLIC_SIGN_IN_URL',
])
    process.env[key] = 'https://quota-fixture.test'

void test('production mobile stores reject paid work when quota is exhausted and reuse cached results', async (t) => {
    const commands: unknown[][] = []
    let cachedOutline = false
    let cachedLanguage = false
    let allow = false
    const pages = ['Chapter one']
    const entries = [{ title: 'Chapter one', page: 1, depth: 0 }]
    const texts = new Map<string, Record<string, unknown>>()
    t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(input instanceof Request ? input.url : String(input))
        if (url.hostname === 'bookmark.test')
            return new Response('<title>Saved page</title>', {
                headers: { 'content-type': 'text/html' },
            })
        assert.equal(url.hostname, 'quota-fixture.test', 'Unexpected provider request')
        if (url.pathname.endsWith('/users')) return Response.json([{ id: 'reader', plan: 'beginner' }])
        if (url.pathname.endsWith('/apple_subscriptions')) return Response.json([])
        if (url.pathname.endsWith('/texts')) {
            if (init?.method === 'POST') {
                const row = JSON.parse(String(init.body))
                texts.set(row.id, { ...row, no: null, created_at: null, updated_at: null, topics: [] })
                return new Response(null, { status: 201 })
            }
            return Response.json(texts.get(url.searchParams.get('id')?.slice(3) ?? '') ?? null)
        }
        const execute = (command: unknown[]) => {
            commands.push(command)
            const [name, key] = command
            if (name === 'set') return 'OK'
            if (name === 'get') {
                if (cachedOutline && String(key).startsWith('mobile:pdf-outline-generation:'))
                    return JSON.stringify({
                        fingerprint: createHash('sha256').update(JSON.stringify(pages)).digest('hex'),
                        result: { entries },
                    })
                if (cachedLanguage && String(key).startsWith('browser:language:')) return JSON.stringify('en')
                return null
            }
            if (name === 'eval') return String(key).includes('INCRBYFLOAT') ? (allow ? 1 : 0) : 1
            throw Error('Unexpected Redis command: ' + name)
        }
        const body = JSON.parse(String(init?.body))
        return Response.json(
            Array.isArray(body[0]) ? body.map((c: unknown[]) => ({ result: execute(c) })) : { result: execute(body) },
        )
    })
    const { pdfOutlineStore } = await import('../server/mobile/pdf-outline-store')
    const { detectLanguage } = await import('../server/mobile/language-detection')
    const { browserStore } = await import('../server/mobile/browser-store')
    const { requireCommentaryQuota } = await import('../server/mobile/quota-store')
    const { mobileSubjectSchema } = await import('@repo/schema/mobile')
    const signal = new AbortController().signal
    for (const requestId of ['one', 'two']) {
        await assert.rejects(
            pdfOutlineStore.generate(
                { userId: 'reader', textId: 'book', sourceVersion: 'v1' },
                { requestId, pages, sourceVersion: 'v1' },
                signal,
            ),
            { code: 'quota_exceeded' },
        )
    }
    await assert.rejects(detectLanguage('[[hello]]', 'hello', 'reader'), { code: 'quota_exceeded' })
    const bookmark = await browserStore.bookmark(
        mobileSubjectSchema.parse({ userId: 'reader' }),
        {
            id: 'library',
            name: 'Books',
            lang: 'en',
            owner: 'reader',
            access: 0,
            shadow: false,
            starred_by: null,
        },
        { requestId: 'bookmark-one', url: 'https://bookmark.test/page' },
    )
    assert.equal(bookmark.emoji, '🌐')
    const charges = () => commands.filter((c) => c[0] === 'eval' && String(c[1]).includes('INCRBYFLOAT'))
    assert.deepEqual(
        charges().map((c) => c.at(-2)),
        [1, 1, 0.01, 0.01],
    )
    cachedOutline = true
    cachedLanguage = true
    assert.deepEqual(
        await pdfOutlineStore.generate(
            { userId: 'reader', textId: 'book', sourceVersion: 'v1' },
            { requestId: 'one', pages, sourceVersion: 'v1' },
            signal,
        ),
        { entries },
    )
    assert.equal(await detectLanguage('[[hello]]', 'hello', 'reader'), 'en')
    assert.equal(charges().length, 4)
    allow = true
    await requireCommentaryQuota('reader', 0.01, signal)
    assert.equal(charges().length, 5)
})

test('production annotation generation leaves room for long selections and calls the provider once', async (t) => {
    const calls: number[] = []
    const output = '{{bridge the gap||bridge the gap||弥合差距}}'
    t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(input instanceof Request ? input.url : String(input))
        assert.ok(url.pathname.endsWith('/ai/language-model'))
        const options = z.object({ maxOutputTokens: z.number() }).parse(JSON.parse(String(init?.body)))
        calls.push(options.maxOutputTokens)
        const parts = [
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: 'annotation' },
            { type: 'text-delta', id: 'annotation', delta: output },
            { type: 'text-end', id: 'annotation' },
            {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: {
                    inputTokens: { total: 100 },
                    outputTokens: { total: 30 },
                },
            },
        ]
        return new Response(parts.map((part) => `data: ${JSON.stringify(part)}\n\n`).join(''), {
            headers: { 'content-type': 'text/event-stream' },
        })
    })
    const { definitionServices } = await import('../server/mobile/definition-services')
    const quote = '字'.repeat(1024)
    for (const language of ['en', 'fr', 'ja', 'zh', 'nl'] as const) {
        let raw = ''
        for await (const delta of definitionServices.generate(
            `[[${quote}]]`,
            language,
            '',
            new AbortController().signal,
        ))
            raw += delta
        assert.equal(raw, output)
    }
    assert.equal(calls.length, 5)
    // The format repeats the selected text in two required fields before explaining it.
    assert.ok(
        calls.every((budget) => budget > quote.length * 2),
        'Long selections must leave room for the explanation after both required fields',
    )
})
