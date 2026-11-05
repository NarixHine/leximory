import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@repo/supabase/types'
import { z } from 'zod'
import { mobileSubjectSchema } from '@repo/schema/mobile'
import {
    createAccountDeletionOperations,
    createAccountDeletionReceiptEndpoint,
    requireRecentAuthentication,
    type AccountDeletionStore,
    type DeletionRecord,
} from '../server/mobile/account-deletion'
import { createAccountDeletionPersistence } from '../server/mobile/account-deletion-persistence'
import { testMobileHandler } from './helpers/mobile'

const userId = '11111111-1111-4111-8111-111111111111'
const otherId = '22222222-2222-4222-8222-222222222222'
const requestId = '33333333-3333-4333-8333-333333333333'
const token = 'a'.repeat(64)
const now = 1_800_000_000_000
const credential = (timestamp = now / 1000, method = 'password') =>
    `header.${Buffer.from(JSON.stringify({ sub: userId, amr: [{ method, timestamp }] })).toString('base64url')}.signature`

test('deletion requires recent actual authentication, not a newly refreshed JWT', () => {
    assert.doesNotThrow(() => requireRecentAuthentication(credential(), userId, now))
    assert.doesNotThrow(() => requireRecentAuthentication(credential(now / 1000, 'oauth'), userId, now))
    for (const value of [credential(now / 1000 - 601), credential(now / 1000, 'token_refresh'), 'malformed'])
        assert.throws(() => requireRecentAuthentication(value, userId, now), { code: 'reauthentication_required' })
    assert.throws(() => requireRecentAuthentication(credential(), otherId, now), { code: 'reauthentication_required' })
})

function deletionHarness() {
    let record: DeletionRecord | null = null
    const calls: string[] = []
    const store: AccountDeletionStore = {
        async read(id) {
            return record?.requestId === id ? record : null
        },
        async begin(value) {
            record ??= value
            calls.push('begin')
            return record
        },
        async freeze() {
            calls.push('freeze')
        },
        async enqueue() {
            calls.push('enqueue')
        },
    }
    const subject = mobileSubjectSchema.parse({ userId })
    const handler = testMobileHandler(
        createAccountDeletionOperations(store, () => now),
        async () => ({ kind: 'authenticated', subject }),
    )
    const request = (body: unknown = { requestId, receiptToken: token, expectedUserId: userId }, jwt = credential()) =>
        new Request('https://fixture.test/api/mobile/v1/account/deletion', {
            method: 'POST',
            headers: { authorization: `Bearer ${jwt}` },
            body: JSON.stringify(body),
        })
    return { store, calls, handler, request }
}

test('deletion acceptance is replayable and never accepts a client user identity', async () => {
    const { handler, request, calls } = deletionHarness()
    assert.equal((await handler(request({ requestId, receiptToken: token, userId: otherId }))).status, 400)
    assert.equal((await handler(request({ requestId, receiptToken: token, expectedUserId: otherId }))).status, 400)
    assert.equal((await handler(request(undefined, credential(now / 1000 - 601)))).status, 401)
    assert.deepEqual(calls, [])
    assert.deepEqual(await (await handler(request())).json(), { requestId, status: 'pending' })
    assert.deepEqual(await (await handler(request())).json(), { requestId, status: 'pending' })
    assert.deepEqual(calls, ['begin', 'freeze', 'enqueue', 'freeze', 'enqueue'])
    assert.equal((await handler(request({ requestId, receiptToken: 'b'.repeat(64) }))).status, 400)
})

test('the persisted receipt resolves status and retries after Auth is gone', async () => {
    const { handler, request, store, calls } = deletionHarness()
    await handler(request())
    const context = { params: Promise.resolve({ requestId }) }
    const status = createAccountDeletionReceiptEndpoint(store, false)
    const retry = createAccountDeletionReceiptEndpoint(store, true)
    const receiptRequest = (method = 'GET', receipt = token) =>
        new Request(`https://fixture.test/api/mobile/v1/account/deletion/${requestId}`, {
            method,
            headers: { authorization: `Bearer ${receipt}` },
        })
    const response = await status(receiptRequest(), context)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.deepEqual(await response.json(), { requestId, status: 'pending' })
    assert.equal((await status(receiptRequest('GET', 'b'.repeat(64)), context)).status, 404)
    assert.deepEqual(await (await retry(receiptRequest('POST'), context)).json(), { requestId, status: 'pending' })
    assert.deepEqual(calls, ['begin', 'freeze', 'enqueue', 'freeze', 'enqueue'])
})

function databaseFixture() {
    const tables: Record<string, Record<string, unknown>[]> = {
        users: [
            { id: userId, token: 'personal-token' },
            { id: otherId, token: 'keep' },
        ],
        libraries: [
            { id: 'own-folder', owner: userId, starred_by: null },
            { id: 'other-folder', owner: otherId, starred_by: [userId, otherId] },
        ],
        texts: [
            { id: 'own-book', lib: 'own-folder', content: ':::owned-audio\nA private text.\n:::' },
            { id: 'other-book', lib: 'other-folder', content: 'A different text.' },
        ],
        papers: [
            { id: 10, creator: userId },
            { id: 20, creator: otherId },
        ],
        notes: [
            { id: 1, creator: userId, related_paper: 20 },
            { id: 2, creator: otherId, related_paper: 10 },
        ],
        submissions: [
            { id: 1, user: userId, paper: 20 },
            { id: 2, user: otherId, paper: 20 },
        ],
        dictations: [
            { id: 1, paper: 10 },
            { id: 2, paper: 20 },
        ],
        lexicon: [
            { id: 'own-word', lib: 'own-folder' },
            { id: 'other-word', lib: 'other-folder' },
        ],
        apple_subscriptions: [
            {
                original_transaction_id: 'transaction',
                user_id: userId,
                signed_transaction_info: 'retained-billing-evidence',
            },
        ],
        browser_domain_rules: [{ user_id: userId, library_id: 'own-folder' }],
        bookmarks: [
            { uid: userId, text: 'other-book' },
            { uid: otherId, text: 'other-book' },
        ],
        reads: [
            { uid: userId, text: 'other-book' },
            { uid: otherId, text: 'other-book' },
        ],
        pdf_page_notes: [
            { user_id: userId, text_id: 'other-book' },
            { user_id: otherId, text_id: 'other-book' },
        ],
        flashbacks: [{ user: userId }, { user: otherId }],
        subs: [{ uid: userId }, { uid: otherId }],
    }
    const removedFiles: string[] = []
    const calls: string[] = []
    let authDeleted = false
    let frozen = false
    let rejectTable: string | null = null
    let rejectStorage = false
    const matches = (row: Record<string, unknown>, parameters: URLSearchParams) =>
        [...parameters].every(([key, value]) => {
            if (['select', 'order', 'offset', 'limit'].includes(key)) return true
            const item = row[key]
            if (value.startsWith('eq.'))
                return Array.isArray(item) ? `{${item.join(',')}}` === value.slice(3) : String(item) === value.slice(3)
            if (value.startsWith('in.(')) return value.slice(4, -1).split(',').includes(String(item))
            if (value.startsWith('cs.{')) return Array.isArray(item) && item.includes(value.slice(4, -1))
            if (value.startsWith('like.')) return String(item).includes(value.slice(5).replaceAll('%', ''))
            assert.fail(`Unexpected external filter ${key}=${value}`)
        })
    const database = createClient<Database>('https://database.test', 'test-service-key', {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
            fetch: async (resource, init) => {
                const url = new URL(String(resource))
                const method = init?.method ?? 'GET'
                calls.push(`${method} ${url.pathname}`)
                if (url.pathname === `/auth/v1/admin/users/${userId}`) {
                    if (method === 'DELETE') {
                        authDeleted = true
                        return Response.json({})
                    }
                    if (authDeleted)
                        return Response.json({ error_code: 'user_not_found', msg: 'User not found' }, { status: 404 })
                    if (method === 'PUT') {
                        const body = z
                            .object({
                                app_metadata: z.object({ account_deletion: z.string(), existing: z.boolean() }),
                                ban_duration: z.string(),
                            })
                            .parse(JSON.parse(String(init?.body)))
                        assert.equal(body.app_metadata.existing, true)
                        assert.equal(body.ban_duration, '876000h')
                        frozen = true
                    }
                    return Response.json({
                        id: userId,
                        app_metadata: { existing: true, ...(frozen ? { account_deletion: requestId } : {}) },
                        user_metadata: {},
                        created_at: '2026-01-01T00:00:00Z',
                    })
                }
                if (url.pathname === '/storage/v1/object/list/user-files') {
                    const body = z.object({ prefix: z.string() }).parse(JSON.parse(String(init?.body)))
                    return Response.json(
                        body.prefix === 'pdf-outlines/own-book' ? [{ id: 'outline', name: 'outlined.pdf' }] : [],
                    )
                }
                if (url.pathname.startsWith('/storage/v1/object/')) {
                    if (rejectStorage) return Response.json({ message: 'storage unavailable' }, { status: 503 })
                    const body = z.object({ prefixes: z.array(z.string()) }).parse(JSON.parse(String(init?.body)))
                    removedFiles.push(...body.prefixes)
                    return Response.json(body.prefixes.map((name) => ({ name })))
                }
                const table = url.pathname.slice('/rest/v1/'.length)
                const rows = tables[table]
                assert.ok(rows, `Unexpected external resource ${url.pathname}`)
                if (table === rejectTable && method !== 'GET')
                    return Response.json({ code: '42501', message: 'write rejected' }, { status: 403 })
                const selected = rows.filter((row) => matches(row, url.searchParams))
                if (method === 'DELETE') tables[table] = rows.filter((row) => !selected.includes(row))
                if (method === 'PATCH') {
                    const values = z.record(z.string(), z.unknown()).parse(JSON.parse(String(init?.body)))
                    for (const row of selected) Object.assign(row, values)
                }
                if (method !== 'GET') return new Response(null, { status: 204 })
                const offset = Number(url.searchParams.get('offset') ?? 0)
                return Response.json(
                    selected.slice(offset, offset + Number(url.searchParams.get('limit') ?? rows.length)),
                )
            },
        },
    })
    return {
        persistence: createAccountDeletionPersistence(database),
        tables,
        removedFiles,
        calls,
        authDeleted: () => authDeleted,
        reject: (table: string | null) => {
            rejectTable = table
        },
        rejectStorage: () => {
            rejectStorage = true
        },
    }
}

test('production SDK adapter explicitly deletes owned records and files while preserving other accounts and billing facts', async () => {
    const fixture = databaseFixture()
    const store = fixture.persistence
    await store.freeze(userId, requestId)
    assert.equal(fixture.tables.users?.[0]?.token, null)
    const manifest = await store.inventory(userId)
    assert.deepEqual(manifest.libraries, ['own-folder'])
    assert.deepEqual(manifest.papers, [10])
    assert.deepEqual(manifest.files, [
        'ebooks/own-book.pdf',
        'ebooks/own-book.epub',
        'pdf-outlines/own-book/outlined.pdf',
    ])
    await store.files(manifest, userId)
    await store.records(manifest, userId)
    await store.audio(manifest)
    assert.equal(fixture.authDeleted(), false)
    await store.auth(userId)
    assert.equal(fixture.authDeleted(), true)
    assert.deepEqual(fixture.tables.users, [{ id: otherId, token: 'keep' }])
    assert.deepEqual(fixture.tables.libraries, [{ id: 'other-folder', owner: otherId, starred_by: [otherId] }])
    assert.deepEqual(fixture.tables.texts, [{ id: 'other-book', lib: 'other-folder', content: 'A different text.' }])
    assert.deepEqual(fixture.tables.notes, [{ id: 2, creator: otherId, related_paper: null }])
    assert.deepEqual(fixture.tables.apple_subscriptions, [
        { original_transaction_id: 'transaction', user_id: null, signed_transaction_info: 'retained-billing-evidence' },
    ])
    assert.ok(fixture.removedFiles.includes('audio/owned-audio.mp3'))
    assert.equal(fixture.removedFiles.includes('ebooks/other-book.pdf'), false)
    await store.files(manifest, userId)
    await store.records(manifest, userId)
    await store.auth(userId)
    assert.deepEqual(fixture.tables.users, [{ id: otherId, token: 'keep' }])
})

test('SDK deletion tolerates an absent profile and propagates rejected writes instead of reporting completion', async () => {
    const fixture = databaseFixture()
    fixture.tables.users = []
    await fixture.persistence.freeze(userId, requestId)
    const manifest = await fixture.persistence.inventory(userId)
    fixture.reject('flashbacks')
    await assert.rejects(fixture.persistence.records(manifest, userId))
    assert.equal(fixture.authDeleted(), false)
    assert.ok(fixture.tables.texts?.some((row) => row.id === 'own-book'))
    fixture.reject(null)
    await fixture.persistence.records(manifest, userId)
    assert.equal(
        fixture.tables.texts?.some((row) => row.id === 'own-book'),
        false,
    )
})

test('SDK storage failure leaves metadata available for a safe retry', async () => {
    const fixture = databaseFixture()
    const manifest = await fixture.persistence.inventory(userId)
    fixture.rejectStorage()
    await assert.rejects(fixture.persistence.files(manifest, userId))
    assert.ok(fixture.tables.texts?.some((row) => row.id === 'own-book'))
    assert.equal(fixture.authDeleted(), false)
})

for (const stage of ['freeze', 'enqueue'] as const) {
    test(`POST replay resumes deletion acceptance after ${stage} fails`, async () => {
        const h = deletionHarness()
        const original = h.store[stage]
        let fail = true
        h.store[stage] = async (record) => {
            if (fail) {
                fail = false
                throw new Error('Temporary acceptance failure')
            }
            await original(record)
        }
        assert.equal((await h.handler(h.request())).status, 503)
        const accepted = await h.handler(h.request())
        assert.equal(accepted.status, 200)
        assert.deepEqual(await accepted.json(), { requestId, status: 'pending' })
        assert.equal(h.calls.filter((call) => call === 'enqueue').length, 1)
        assert.equal(h.calls.filter((call) => call === 'freeze').length, stage === 'freeze' ? 1 : 2)
        assert.equal(h.calls.filter((call) => call === 'begin').length, 1)
    })
}

test('POST replay keeps reporting failed acceptance and never requeues completed deletion', async () => {
    const h = deletionHarness()
    h.store.enqueue = async () => {
        throw new Error('Queue unavailable')
    }
    assert.equal((await h.handler(h.request())).status, 503)
    assert.equal((await h.handler(h.request())).status, 503)
    const record = await h.store.read(requestId)
    assert.ok(record)
    h.store.read = async () => ({ ...record, status: 'completed' })
    const calls = [...h.calls]
    assert.deepEqual(await (await h.handler(h.request())).json(), { requestId, status: 'completed' })
    assert.deepEqual(h.calls, calls)
})
