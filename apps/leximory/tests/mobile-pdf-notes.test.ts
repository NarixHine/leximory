import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@repo/supabase/types'
import { mobileSubjectSchema } from '@repo/schema/mobile'
import { createPDFNotesOperations, type PDFPageDrawing, type PDFNotesStore } from '../server/mobile/pdf-notes'
import { createPDFNotesStore } from '../server/mobile/pdf-notes-store'
import type { CatalogStore } from '../server/mobile/catalog'
import { testMobileHandler } from './helpers/mobile'

const firstRevision = '00000000-0000-4000-8000-000000000001'
const secondRevision = '00000000-0000-4000-8000-000000000002'
const thirdRevision = '00000000-0000-4000-8000-000000000003'
const note: PDFPageDrawing = {
    pageIndex: 3,
    drawingBase64: Buffer.from('editable drawing').toString('base64'),
    canvasWidth: 612,
    canvasHeight: 792,
    formatVersion: 1,
    revision: firstRevision,
}
const subject = mobileSubjectSchema.parse({ userId: 'reader' })
const catalog: CatalogStore = {
    library: async () => ({
        id: 'folder',
        name: 'Books',
        lang: 'en',
        owner: 'reader',
        access: 0,
        starred_by: null,
        shadow: false,
    }),
    text: async () => ({
        id: 'book',
        lib: 'folder',
        title: 'Book',
        content: '',
        no: null,
        created_at: null,
        updated_at: null,
        topics: [],
        emoji: null,
        has_ebook: true,
    }),
    libraries: async () => [],
    texts: async () => [],
    archived: async () => [],
    audio: async () => null,
}
function request(body?: unknown, query = '?pdfVersion=source-v1') {
    return new Request('https://example.com/api/mobile/v1/texts/book/pdf-notes' + (body ? '' : query), {
        method: body ? 'POST' : 'GET',
        headers: { authorization: 'Bearer test' },
        body: body ? JSON.stringify(body) : undefined,
    })
}
const input = { ...note, pdfVersion: 'source-v1', baseRevision: null }

test('PDF notes authorize text access before touching private note data', async () => {
    let reads = 0
    const notes: PDFNotesStore = {
        next: async () => {
            reads++
            return note
        },
        save: async () => {
            reads++
            return note
        },
    }
    const denied = testMobileHandler(
        createPDFNotesOperations({ catalog: { ...catalog, library: async () => null }, notes }),
        async () => ({ kind: 'authenticated', subject }),
    )
    assert.equal((await denied(request())).status, 404)
    assert.equal((await denied(request(input))).status, 404)
    const signedOut = testMobileHandler(createPDFNotesOperations({ catalog, notes }), async () => ({
        kind: 'unauthenticated',
    }))
    assert.equal((await signedOut(request(input))).status, 401)
    assert.equal(reads, 0)
})

test('PDF notes derive user identity and isolate source versions and page cursors', async () => {
    const scopes: unknown[] = []
    const notes: PDFNotesStore = {
        next: async (scope, after) => {
            scopes.push([scope, after])
            return after < 3 ? note : null
        },
        save: async (scope, value) => {
            scopes.push(scope)
            return value
        },
    }
    const handler = testMobileHandler(createPDFNotesOperations({ catalog, notes }), async () => ({
        kind: 'authenticated',
        subject,
    }))
    const response = await handler(request())
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.deepEqual(await response.json(), { notes: [note], nextCursor: 3 })
    assert.deepEqual(scopes[0], [{ textId: 'book', userId: 'reader', pdfVersion: 'source-v1' }, -1])
    assert.deepEqual(await (await handler(request(undefined, '?pdfVersion=source-v1&after=3'))).json(), {
        notes: [],
        nextCursor: null,
    })
    assert.equal((await handler(request({ ...input, userId: 'victim' }))).status, 400)
    assert.equal((await handler(request(undefined, '?pdfVersion=first&pdfVersion=second'))).status, 400)
    assert.equal((await handler(request(undefined, '?pdfVersion=v&after=-2'))).status, 400)
})

test('PDF notes reject invalid snapshots and surface conflicts without a write retry', async () => {
    let writes = 0
    const notes: PDFNotesStore = {
        next: async () => null,
        save: async () => {
            writes++
            return null
        },
    }
    const handler = testMobileHandler(createPDFNotesOperations({ catalog, notes }), async () => ({
        kind: 'authenticated',
        subject,
    }))
    for (const value of [
        { ...input, pageIndex: -1 },
        { ...input, formatVersion: 2 },
        { ...input, canvasWidth: 0 },
        { ...input, drawingBase64: 'not base64' },
        { ...input, drawingBase64: '====' },
        { ...input, baseRevision: firstRevision },
        { ...input, revision: 'not-a-uuid' },
        {
            ...input,
            revision: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA',
            baseRevision: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        },
    ])
        assert.equal((await handler(request(value))).status, 400)
    assert.equal(writes, 0)
    const response = await handler(request(input))
    assert.equal(response.status, 409)
    assert.equal((await response.json()).error.code, 'stale_revision')
    assert.equal(writes, 1)
})

test('PDF first saves default an omitted base revision to an insert', async () => {
    let base: string | null | undefined
    const notes: PDFNotesStore = {
        next: async () => null,
        save: async (_scope, value) => {
            base = value.baseRevision
            return note
        },
    }
    const handler = testMobileHandler(createPDFNotesOperations({ catalog, notes }), async () => ({
        kind: 'authenticated',
        subject,
    }))
    const { baseRevision: _, ...firstSave } = input
    const response = await handler(request(firstSave))
    assert.equal(response.status, 200)
    assert.equal(base, null)
})

test('PDF note database writes compare revisions atomically and acknowledge identical retries', async () => {
    type Row = Database['public']['Tables']['pdf_page_notes']['Row']
    let rows: Row[] = []
    const database = createClient<Database>('https://database.example', 'server-test-key', {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
            fetch: async (resource, init) => {
                const url = new URL(String(resource))
                const filters = [...url.searchParams].filter(([key]) => !['select', 'limit', 'order'].includes(key))
                const matches = (row: Row) =>
                    filters.every(([key, value]) => {
                        const fields: Record<string, unknown> = { ...row }
                        const [operator, expected] = [
                            value.slice(0, value.indexOf('.')),
                            value.slice(value.indexOf('.') + 1),
                        ]
                        return operator === 'eq'
                            ? String(fields[key]) === expected
                            : operator === 'gt' && Number(fields[key]) > Number(expected)
                    })
                let selected = rows.filter(matches)
                if (init?.method === 'POST') {
                    const added: Row = JSON.parse(String(init.body))
                    if (
                        rows.some(
                            (row) =>
                                row.user_id === added.user_id &&
                                row.text_id === added.text_id &&
                                row.pdf_version === added.pdf_version &&
                                row.page_index === added.page_index,
                        )
                    )
                        return Response.json({ code: '23505', message: 'duplicate' }, { status: 409 })
                    rows.push(added)
                    selected = [added]
                } else if (init?.method === 'PATCH') {
                    const values: Partial<Row> = JSON.parse(String(init.body))
                    rows = rows.map((row) => (matches(row) ? { ...row, ...values } : row))
                    selected = rows.filter((row) =>
                        selected.some(
                            (old) =>
                                old.user_id === row.user_id &&
                                old.page_index === row.page_index &&
                                old.pdf_version === row.pdf_version,
                        ),
                    )
                } else
                    selected = selected
                        .sort((a, b) => a.page_index - b.page_index)
                        .slice(0, Number(url.searchParams.get('limit') ?? rows.length))
                return Response.json(
                    new Headers(init?.headers).get('accept') === 'application/vnd.pgrst.object+json'
                        ? (selected[0] ?? null)
                        : selected,
                )
            },
        },
    })
    const store = createPDFNotesStore(database)
    const scope = { userId: 'reader', textId: 'book', pdfVersion: 'source-v1' }
    const signal = new AbortController().signal
    assert.deepEqual(await store.save(scope, input, signal), note)
    assert.deepEqual(await store.save(scope, input, signal), note)
    assert.equal(await store.save(scope, { ...input, drawingBase64: 'YWJj' }, signal), null)
    const outcomes = await Promise.all([
        store.save(scope, { ...input, baseRevision: firstRevision, revision: secondRevision }, signal),
        store.save(scope, { ...input, baseRevision: firstRevision, revision: thirdRevision }, signal),
    ])
    assert.equal(outcomes.filter(Boolean).length, 1)
    assert.equal(rows.length, 1)
    assert.equal(await store.save(scope, input, signal), null)
    assert.equal(await store.next({ ...scope, userId: 'other' }, -1, signal), null)
    assert.equal(await store.next({ ...scope, pdfVersion: 'replacement' }, -1, signal), null)
    assert.equal(await store.next(scope, 3, signal), null)
})
