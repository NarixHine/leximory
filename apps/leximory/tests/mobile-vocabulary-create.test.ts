import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@repo/supabase/types'
import { mobileSubjectSchema } from '@repo/schema/mobile'
import { createVocabularyOperations } from '../server/mobile/vocabulary-create'
import { createVocabularyStore } from '../server/mobile/vocabulary-create-store'
import { testMobileHandler } from './helpers/mobile'
import { guestRedisFixture } from './helpers/guest-redis'

const subject = mobileSubjectSchema.parse({ userId: 'reader' })
const fields = { original: 'bank', lemma: 'bank', definition: '河岸', etymology: null, cognates: null }
function request(body: unknown) {
    return new Request('https://leximory.test/api/mobile/v1/vocabulary', {
        method: 'POST',
        headers: { authorization: 'Bearer account' },
        body: JSON.stringify(body),
    })
}

test('the installed Supabase adapter saves an authored definition once across races and lost responses', async (t) => {
    const receipts = guestRedisFixture()
    const rows = new Map<string, { id: string; lib: string; word: string }>()
    let writes = 0
    let loseResponse = true
    let rejectWrites = false
    const fetcher: typeof fetch = async (input, options) => {
        const url = new URL(input instanceof Request ? input.url : String(input))
        if (url.hostname === 'guest-redis.fixture.invalid') return receipts.fetcher(input, options)
        const table = url.pathname.split('/').at(-1)
        const id = url.searchParams.get('id')?.replace(/^eq\./, '')
        if (table === 'libraries') return Response.json({ owner: subject.userId })
        if (options?.method === 'POST') {
            assert.equal(table, 'lexicon')
            if (rejectWrites) return Response.json({ code: 'XX000', message: 'Write rejected' }, { status: 503 })
            const raw: unknown = JSON.parse(String(options.body))
            assert.ok(typeof raw === 'object' && raw !== null && 'id' in raw && 'lib' in raw && 'word' in raw)
            assert.equal(typeof raw.id, 'string')
            assert.equal(typeof raw.lib, 'string')
            assert.equal(typeof raw.word, 'string')
            const value = { id: String(raw.id), lib: String(raw.lib), word: String(raw.word) }
            assert.equal(url.searchParams.get('on_conflict'), 'id')
            assert.match(new Headers(options.headers).get('prefer') ?? '', /resolution=ignore-duplicates/)
            if (!rows.has(value.id)) {
                rows.set(value.id, value)
                writes++
            }
            if (loseResponse) {
                loseResponse = false
                throw new Error('Response lost after database commit')
            }
            return new Response(null, { status: 201 })
        }
        return Response.json(id ? (rows.get(id) ?? null) : null)
    }
    t.mock.method(globalThis, 'fetch', fetcher)
    const database = createClient<Database>('https://vocabulary.fixture.invalid', 'fixture', {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: fetcher },
    })
    const handler = testMobileHandler(
        createVocabularyOperations(
            createVocabularyStore({
                database,
                receipts: receipts.redis,
                destination: async (_subject, language) => {
                    assert.equal(language, 'en')
                    return 'english-warehouse'
                },
            }),
        ),
        async () => ({ kind: 'authenticated', subject }),
    )
    const body = { requestId: randomUUID(), language: 'en', fields }
    const first = await handler(request(body))
    assert.equal(first.status, 503, JSON.stringify({ body: await first.clone().json(), redis: [...receipts.values] }))
    assert.equal(writes, 1)
    const repeated = await Promise.all([handler(request(body)), handler(request(body))])
    for (const response of repeated) {
        assert.equal(response.status, 200)
        const saved = await response.json()
        assert.equal(saved.libraryId, 'english-warehouse')
        assert.equal(rows.get(saved.id)?.word, '{{bank||bank||河岸}}')
    }
    assert.equal(writes, 1)
    assert.equal((await handler(request({ ...body, fields: { ...fields, definition: 'Different' } }))).status, 400)
    rejectWrites = true
    assert.equal((await handler(request({ ...body, requestId: randomUUID() }))).status, 503)
    assert.equal(writes, 1)
})

test('authored vocabulary rejects malformed and batch payloads before creating any record', async () => {
    let writes = 0
    const handler = testMobileHandler(
        createVocabularyOperations({
            save: async () => {
                writes++
                return { id: 'word', libraryId: 'library' }
            },
        }),
        async () => ({ kind: 'authenticated', subject }),
    )
    for (const body of [
        { requestId: randomUUID(), words: [{ language: 'en', fields }] },
        { requestId: randomUUID(), language: 'en', fields: { ...fields, definition: '}} injected' } },
        { requestId: randomUUID(), language: 'other', fields },
    ])
        assert.equal((await handler(request(body))).status, 400)
    assert.equal(writes, 0)
})
