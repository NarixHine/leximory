import { test } from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@repo/supabase/types'
import { homePinDestinationSchema } from '@repo/api'
import { mobileSubjectSchema } from '@repo/schema/mobile'
import { createHomePinsOperations, type HomePinSave } from '../server/mobile/home-pins'
import { createHomePinsStore } from '../server/mobile/home-pins-store'
import { testMobileHandler } from './helpers/mobile'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const user = id(1)
const other = id(2)
const pinId = id(3)
const revision = id(4)
const input: HomePinSave = {
    title: 'Reading',
    destination: { kind: 'webpage', url: 'https://reading.example/article' },
    faviconURL: null,
    sortOrder: 0,
    revision,
    expectedRevision: null,
    deleted: false,
}
type Row = Database['public']['Tables']['browser_home_pins']['Row']
const valuesSchema = z.object({
    title: z.string(),
    destination: homePinDestinationSchema,
    favicon_url: z.string().nullable(),
    sort_order: z.number(),
    revision: z.string(),
    deleted_at: z.string().nullable(),
    updated_at: z.string(),
})
function row(n: number, owner = user): Row {
    return {
        id: id(n),
        user_id: owner,
        title: 'Pin ' + n,
        destination: input.destination,
        favicon_url: null,
        sort_order: n,
        revision,
        deleted_at: n % 2 ? null : '2026-11-01T00:00:00Z',
        updated_at: '2026-11-01T00:00:00Z',
        created_at: '2026-11-01T00:00:00Z',
    }
}
function fixture(initial: Row[] = []) {
    const state = { rows: initial, requests: 0, rejectWrites: false, loseResponse: false }
    const database = createClient<Database>('https://database.example', 'server-test-key', {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
            fetch: async (resource, init) => {
                state.requests++
                const url = new URL(String(resource))
                assert.equal(url.pathname, '/rest/v1/browser_home_pins')
                const filters = [...url.searchParams].filter(([key]) => !['select', 'order', 'limit'].includes(key))
                const matches = (record: Row) =>
                    filters.every(([key, expression]) => {
                        const value = Object.entries(record).find(([field]) => field === key)?.[1]
                        const separator = expression.indexOf('.')
                        const operator = expression.slice(0, separator)
                        const expected = expression.slice(separator + 1)
                        if (operator === 'eq') return String(value) === expected
                        if (operator === 'gt') return String(value) > expected
                        if (operator === 'is' && expected === 'null') return value === null
                        throw new Error('Unexpected filter ' + expression)
                    })
                let selected = state.rows.filter(matches)
                if (init?.method === 'POST' || init?.method === 'PATCH') {
                    if (state.rejectWrites) return Response.json({ message: 'write rejected' }, { status: 503 })
                    const raw: unknown = JSON.parse(String(init.body))
                    const values = valuesSchema.parse(raw)
                    if (init.method === 'POST') {
                        const identity = z.object({ id: z.string(), user_id: z.string() }).parse(raw)
                        if (
                            state.rows.some(
                                (record) => record.id === identity.id && record.user_id === identity.user_id,
                            )
                        ) {
                            return Response.json({ code: '23505', message: 'duplicate pin' }, { status: 409 })
                        }
                        const added = { ...values, ...identity, created_at: values.updated_at }
                        state.rows.push(added)
                        selected = [added]
                    } else {
                        assert.equal(url.searchParams.get('deleted_at'), 'is.null')
                        assert.ok(url.searchParams.has('user_id'))
                        assert.ok(url.searchParams.has('revision'))
                        selected = selected.map((record) => ({ ...record, ...values }))
                        state.rows = state.rows.map(
                            (record) =>
                                selected.find((saved) => saved.id === record.id && saved.user_id === record.user_id) ??
                                record,
                        )
                    }
                    if (state.loseResponse) {
                        state.loseResponse = false
                        throw new Error('Committed response was lost')
                    }
                } else {
                    assert.equal(init?.method, 'GET')
                    selected = selected
                        .sort((a, b) => a.id.localeCompare(b.id))
                        .slice(0, Number(url.searchParams.get('limit') ?? selected.length))
                }
                return Response.json(
                    new Headers(init?.headers).get('accept') === 'application/vnd.pgrst.object+json'
                        ? (selected[0] ?? null)
                        : selected,
                )
            },
        },
    })
    const store = createHomePinsStore(database)
    const operations = createHomePinsOperations(store)
    const handler = testMobileHandler(operations, async () => ({
        kind: 'authenticated',
        subject: mobileSubjectSchema.parse({ userId: user }),
    }))
    return { state, store, handler, operations }
}
function request(body?: unknown, suffix = '') {
    return new Request(
        'https://app.example/api/mobile/v1/browser/home-pins' + (body === undefined ? suffix : '/' + pinId),
        {
            method: body === undefined ? 'GET' : 'POST',
            headers: { authorization: 'Bearer test' },
            body: body === undefined ? undefined : JSON.stringify(body),
        },
    )
}
const signal = new AbortController().signal

test('home pins require authentication and reject forged ownership, unsafe URLs and unbounded inputs', async () => {
    const { state, operations, handler } = fixture()
    const anonymous = testMobileHandler(operations, async () => ({ kind: 'unauthenticated' }))
    assert.equal((await anonymous(request())).status, 401)
    assert.equal((await anonymous(request(input))).status, 401)
    for (const value of [
        { ...input, userId: other },
        { ...input, expectedRevision: revision },
        { ...input, title: ' '.repeat(5) },
        { ...input, title: 'x'.repeat(257) },
        { ...input, sortOrder: -1 },
        { ...input, faviconURL: 'data:image/png;base64,AAAA' },
        { ...input, faviconURL: 'https://name:password@example.com/icon' },
        { ...input, destination: { kind: 'webpage', url: 'javascript:alert(1)' } },
        { ...input, destination: { kind: 'webpage', url: 'https://example.com/' + 'x'.repeat(4096) } },
        { ...input, destination: { kind: 'webpage', url: 'file:///private/file' } },
    ])
        assert.equal((await handler(request(value))).status, 400)
    assert.equal((await handler(request(undefined, '?cursor=invalid'))).status, 400)
    assert.equal((await handler(request(undefined, `?cursor=${id(1)}&cursor=${id(2)}`))).status, 400)
    assert.equal(state.requests, 0)
})

test('home pin first insert works without a public profile or preferences and normalizes display URLs', async () => {
    const { state, handler } = fixture()
    const response = await handler(
        request({ ...input, destination: { kind: 'webpage', url: 'HTTPS://Reading.Example' } }),
    )
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    const saved = await response.json()
    assert.equal(saved.destination.url, 'https://reading.example/')
    assert.equal(saved.faviconURL, null)
    assert.equal(state.rows[0]?.user_id, user)
    assert.equal(state.rows.length, 1)
    const collision = await handler(request({ ...input, title: 'another device', revision: id(5) }))
    assert.deepEqual(await collision.json(), saved)
    assert.equal(state.rows.length, 1)
})

test('home pin CAS serializes concurrent device edits and returns the winning record to the loser', async () => {
    const { store, state } = fixture()
    await store.save(user, pinId, input, signal)
    const outcomes = await Promise.all([
        store.save(
            user,
            pinId,
            { ...input, expectedRevision: revision, revision: id(5), title: 'first device', sortOrder: 2 },
            signal,
        ),
        store.save(
            user,
            pinId,
            { ...input, expectedRevision: revision, revision: id(6), title: 'second device', sortOrder: 3 },
            signal,
        ),
    ])
    assert.deepEqual(outcomes[0], outcomes[1])
    assert.ok([id(5), id(6)].includes(outcomes[0]?.revision ?? ''))
    assert.equal(state.rows.length, 1)
    assert.equal(state.rows[0]?.sort_order, outcomes[0]?.revision === id(5) ? 2 : 3)
    assert.equal(
        await store.save(other, pinId, { ...input, expectedRevision: revision, revision: id(7) }, signal),
        null,
    )
    assert.deepEqual(await store.list(other, undefined, signal), { items: [], nextCursor: null })
})

test('home pin response loss replays committed inserts and updates without changing their revision or timestamps', async () => {
    const { state, store } = fixture()
    state.loseResponse = true
    await assert.rejects(() => store.save(user, pinId, input, signal))
    const created = await store.save(user, pinId, input, signal)
    assert.equal(created?.revision, revision)
    assert.equal(state.rows.length, 1)
    const edit = { ...input, expectedRevision: revision, revision: id(5), title: 'edited' }
    state.loseResponse = true
    await assert.rejects(() => store.save(user, pinId, edit, signal))
    const replay = await store.save(user, pinId, edit, signal)
    assert.equal(replay?.revision, id(5))
    assert.equal(replay?.updatedAt, state.rows[0]?.updated_at)
    assert.equal(replay?.title, 'edited')
})

test('home pin tombstones survive stale and fresh revision updates, delayed inserts, and deletion retries', async () => {
    const { store, state } = fixture()
    await store.save(user, pinId, input, signal)
    const deletion = { ...input, expectedRevision: revision, revision: id(5), deleted: true }
    const removed = await store.save(user, pinId, deletion, signal)
    assert.ok(removed?.deletedAt)
    assert.deepEqual(await store.save(user, pinId, deletion, signal), removed)
    assert.deepEqual(
        await store.save(user, pinId, { ...input, revision: id(6), expectedRevision: id(5) }, signal),
        removed,
    )
    assert.deepEqual(await store.save(user, pinId, input, signal), removed)
    const repinned = await store.save(user, id(8), { ...input, revision: id(7) }, signal)
    assert.equal(repinned?.deletedAt, null)
    assert.equal(state.rows.length, 2)
    const beforeCreation = await store.save(user, id(9), { ...input, deleted: true }, signal)
    assert.ok(beforeCreation?.deletedAt)
    assert.deepEqual(await store.save(user, id(9), input, signal), beforeCreation)
})

test('home pin keyset pagination returns more than 1000 rows including tombstones and isolates accounts', async () => {
    const records = Array.from({ length: 1005 }, (_, i) => row(i + 10))
    const { store } = fixture([...records, row(2000, other)])
    const items = []
    let cursor: string | undefined
    do {
        const page = await store.list(user, cursor, signal)
        assert.ok(page.items.length <= 100)
        items.push(...page.items)
        cursor = page.nextCursor ?? undefined
    } while (cursor)
    assert.equal(items.length, 1005)
    assert.equal(new Set(items.map((item) => item.id)).size, 1005)
    assert.equal(items.filter((item) => item.deletedAt).length, records.filter((item) => item.deleted_at).length)
    assert.deepEqual(
        (await store.list(other, undefined, signal)).items.map((item) => item.id),
        [id(2000)],
    )
})

test('home pin snapshots never request resource access and same pin IDs are independently scoped to accounts', async () => {
    const { store, state } = fixture()
    const document = {
        ...input,
        destination: {
            kind: 'document',
            text: {
                id: 'article',
                libraryId: 'private-folder',
                title: 'Captured title',
                topics: [],
                emoji: null,
                createdAt: null,
                format: 'article',
            },
        },
    } satisfies HomePinSave
    await store.save(user, pinId, document, signal)
    await store.save(other, pinId, { ...input, title: 'another account' }, signal)
    assert.equal(state.rows.length, 2)
    assert.equal((await store.list(user, undefined, signal)).items[0]?.destination.kind, 'document')
    assert.equal((await store.list(other, undefined, signal)).items[0]?.title, 'another account')
})

test('home pin rejected writes and invalid database snapshots surface failures, missing CAS targets conflict', async () => {
    const { handler, state } = fixture()
    state.rejectWrites = true
    assert.equal((await handler(request(input))).status, 503)
    assert.equal(state.rows.length, 0)
    state.rejectWrites = false
    assert.equal((await handler(request({ ...input, revision: id(5), expectedRevision: revision }))).status, 409)
    state.rows.push({ ...row(10), favicon_url: 'javascript:alert(1)' })
    assert.equal((await handler(request())).status, 503)
})
