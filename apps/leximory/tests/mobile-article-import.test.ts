import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@repo/supabase/types'
import { mobileSubjectSchema } from '@repo/schema/mobile'
import { createArticleImporter } from '../server/mobile/article-import-store'
import { createAuthoringOperations, type AuthoringStore } from '../server/mobile/authoring'
import { textRowSchema, type CatalogStore, type LibraryRow, type TextRow } from '../server/mobile/catalog'
import { testMobileHandler } from './helpers/mobile'
import { createMutationEffects } from '../server/mobile/mutation-effects'

const subject = mobileSubjectSchema.parse({ userId: 'reader' })
const library: LibraryRow = {
    id: 'library',
    name: 'Reading',
    lang: 'en',
    owner: 'reader',
    access: 0,
    starred_by: null,
    shadow: false,
}
const input = {
    requestId: 'one-import',
    title: 'River',
    content: 'Along the river.',
    annotate: true,
    onlyComments: false,
    generateTitle: false,
}
type Stage = 'save-response' | 'queue-response' | 'receipt-read' | 'receipt-write' | 'progress'
function harness(failingStage?: Stage) {
    const rows = new Map<string, TextRow>()
    const accepted = new Map<string, string>()
    const charges = new Set<string>()
    const jobs = new Map<string, unknown>()
    const jobAttempts: string[] = []
    const quotaAttempts: string[] = []
    const background: (() => Promise<void>)[] = []
    const effects = createMutationEffects({
        defer: (work) => {
            background.push(work)
        },
        report: () => {},
        pause: async () => {},
    })
    let failed = false
    function fail(stage: Stage) {
        if (stage === failingStage && !failed) {
            failed = true
            throw new TypeError('temporary lost acknowledgement')
        }
    }
    const database = createClient<Database>('https://database.test', 'test-key', {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
            fetch: async (input, init) => {
                const url = new URL(String(input))
                assert.equal(url.pathname, '/rest/v1/texts')
                if (init?.method === 'POST') {
                    assert.equal(url.searchParams.get('on_conflict'), 'id')
                    assert.match(new Headers(init.headers).get('prefer') ?? '', /resolution=ignore-duplicates/)
                    const row = textRowSchema.parse({
                        topics: null,
                        emoji: null,
                        created_at: '2026-10-29T00:00:00Z',
                        updated_at: null,
                        no: null,
                        ...JSON.parse(String(init.body)),
                    })
                    if (!rows.has(row.id)) rows.set(row.id, row)
                    fail('save-response')
                    return new Response(null, { status: 201 })
                }
                assert.equal(
                    init?.method,
                    'GET',
                    'imports must never delete their saved source on an ambiguous failure',
                )
                const id = url.searchParams.get('id')?.slice(3)
                assert.ok(id)
                return Response.json(rows.get(id) ?? null)
            },
        },
    })
    const article = createArticleImporter({
        effects,
        database,
        charge: async (userId, id) => {
            assert.equal(userId, 'reader')
            quotaAttempts.push(id)
            charges.add(id)
        },
        accepted: {
            get: async (id) => {
                fail('receipt-read')
                return accepted.get(id) ?? null
            },
            set: async (id) => {
                fail('receipt-write')
                accepted.set(id, id)
            },
        },
        markPending: async () => {
            fail('progress')
        },
        enqueue: async (event) => {
            jobAttempts.push(event.id)
            jobs.set(event.id, event.data)
            fail('queue-response')
        },
    })
    const catalog: CatalogStore = {
        library: async () => library,
        libraries: async () => [],
        text: async () => null,
        texts: async () => [],
        archived: async () => [],
        audio: async () => null,
    }
    const authoring: AuthoringStore = {
        article,
        words: async () => ({ items: [], nextCursor: null }),
        word: async () => null,
        updateWord: async () => assert.fail('unexpected word edit'),
        ebook: async () => assert.fail('unexpected book upload'),
        chooseEbookEmoji: async () => assert.fail('unexpected emoji generation'),
        setEbookEmoji: async () => {},
    }
    const handler = testMobileHandler(createAuthoringOperations({ catalog, authoring }), async () => ({
        kind: 'authenticated',
        subject,
    }))
    return {
        rows,
        charges,
        jobs,
        jobAttempts,
        quotaAttempts,
        submit: async (body: unknown = input) => {
            const response = await handler(
                new Request('https://leximory.test/api/mobile/v1/libraries/library/articles', {
                    method: 'POST',
                    headers: { authorization: 'Bearer verified' },
                    body: JSON.stringify(body),
                }),
            )
            for (const work of background.splice(0)) await work()
            return response
        },
    }
}

test('replaying an accepted annotated import returns the saved article without another job or charge', async () => {
    const h = harness()
    const first = await h.submit()
    assert.equal(first.status, 200)
    const saved = await first.json()
    const row = h.rows.get(saved.id)
    assert.ok(row)
    h.rows.set(row.id, { ...row, title: 'Annotated title', content: 'Along the {{river||river||河流}}.', emoji: '🌿' })
    const replay = await h.submit()
    assert.equal(replay.status, 200)
    assert.deepEqual(await replay.json(), { ...saved, title: 'Annotated title', emoji: '🌿' })
    assert.equal(h.rows.size, 1)
    assert.equal(h.quotaAttempts.length, 1)
    assert.equal(h.jobAttempts.length, 1)
})

for (const stage of ['save-response', 'queue-response'] satisfies Stage[]) {
    test(`retry after ${stage} recovers the same text, charge identity, and annotation job`, async () => {
        const h = harness(stage)
        assert.equal((await h.submit()).status, 503)
        assert.equal(h.rows.size, 1, 'the saved source must survive failed acknowledgement')
        const replay = await h.submit()
        assert.equal(replay.status, 200)
        const result = await replay.json()
        assert.equal(result.id, [...h.rows.keys()][0])
        assert.equal(h.rows.size, 1)
        assert.equal(h.charges.size, 1)
        assert.equal(h.jobs.size, 1)
        assert.equal(new Set(h.quotaAttempts).size, 1)
        assert.equal(new Set(h.jobAttempts).size, 1)
    })
}

test('overlapping imports converge on one text and reuse the annotation and quota identities', async () => {
    const h = harness()
    const responses = await Promise.all([h.submit(), h.submit()])
    for (const response of responses) assert.equal(response.status, 200)
    assert.deepEqual(await responses[0]!.json(), await responses[1]!.json())
    assert.equal(h.rows.size, 1)
    assert.equal(h.charges.size, 1)
    assert.equal(h.jobs.size, 1)
})

test('plain-text saves recover a lost response without depending on annotation services', async () => {
    const h = harness('save-response')
    assert.equal((await h.submit({ ...input, annotate: false })).status, 503)
    assert.equal((await h.submit({ ...input, annotate: false })).status, 200)
    assert.equal(h.rows.size, 1)
    assert.equal(h.charges.size, 0)
    assert.equal(h.jobs.size, 0)
})

test('edited import settings create a separate intent and preserve the earlier saved source', async () => {
    const h = harness()
    assert.equal((await h.submit()).status, 200)
    assert.equal((await h.submit({ ...input, content: 'Different article.' })).status, 200)
    assert.equal(h.rows.size, 2)
    assert.deepEqual([...h.rows.values()].map((row) => row.content).sort(), ['Along the river.', 'Different article.'])
})

test('malformed identities and forged account input never write', async () => {
    const h = harness()
    for (const body of [
        { ...input, requestId: '' },
        { ...input, userId: 'other' },
    ])
        assert.equal((await h.submit(body)).status, 400)
    assert.equal(h.rows.size, 0)
    assert.equal(h.charges.size, 0)
})

test('a replay cannot recreate an accepted article after it was deleted', async () => {
    const h = harness()
    assert.equal((await h.submit()).status, 200)
    h.rows.clear()
    assert.equal((await h.submit()).status, 404)
    assert.equal(h.rows.size, 0)
    assert.equal(h.jobAttempts.length, 1)
    assert.equal(h.quotaAttempts.length, 1)
})

for (const stage of ['receipt-read', 'receipt-write', 'progress'] satisfies Stage[]) {
    test(`accepted imports remain successful when ${stage} metadata fails`, async () => {
        const h = harness(stage)
        const response = await h.submit()
        assert.equal(response.status, 200, await response.clone().text())
        assert.equal(h.rows.size, 1)
        assert.equal(h.jobs.size, 1)
    })
}
