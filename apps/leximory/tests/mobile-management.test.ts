import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { Redis } from '@upstash/redis'
import type { Database } from '@repo/supabase/types'
import { createManagementStore } from '../server/mobile/management-store'
import { mobileSubjectSchema } from '@repo/schema/mobile'
import { createManagementOperations, textRevision, type ManagementStore } from '../server/mobile/management'
import type { CatalogStore, LibraryRow, TextRow } from '../server/mobile/catalog'
import { testMobileHandler } from './helpers/mobile'

const library: LibraryRow = {
    id: 'folder',
    name: 'Books',
    lang: 'en',
    owner: 'reader',
    access: 0,
    starred_by: null,
    shadow: false,
}
const article: TextRow = {
    id: 'article',
    lib: 'folder',
    title: 'River',
    topics: ['Nature'],
    emoji: null,
    content: 'A {{bank||bank||河岸}}.',
    has_ebook: false,
    created_at: null,
    updated_at: null,
    no: null,
}
const word = {
    id: 'word',
    libraryId: 'folder',
    fields: { original: 'bank', lemma: 'bank', definition: '河岸', etymology: null, cognates: null },
    protected: false,
}
function harness(
    options: {
        library?: LibraryRow
        text?: TextRow | null
        protected?: boolean
        progress?: string
        authenticated?: boolean
    } = {},
) {
    const writes: unknown[] = []
    let text = options.text === undefined ? article : options.text
    const catalog: CatalogStore = {
        library: async () => options.library ?? library,
        text: async () => text,
        libraries: async () => [],
        texts: async () => [],
        archived: async () => [],
        audio: async () => null,
        progress: async () => options.progress ?? null,
    }
    const management: ManagementStore = {
        edit: async (previous, fields) => {
            writes.push(fields)
            text = { ...previous, ...fields }
            return text
        },
        remove: async (value) => {
            writes.push(['remove', value.id])
            text = null
        },
        replaceEbook: async (value, file) => {
            writes.push(['replace', value.id, file.name, file.type, await file.text()])
        },
        removeEbook: async (value) => {
            writes.push(['detach', value.id])
        },
        removeWord: async (...args) => {
            writes.push(args)
        },
    }
    const operations = createManagementOperations({
        catalog,
        management,
        authoring: { word: async () => ({ ...word, protected: options.protected ?? false }) },
    })
    return {
        writes,
        handler: testMobileHandler(operations, async () =>
            options.authenticated === false
                ? { kind: 'unauthenticated' }
                : { kind: 'authenticated', subject: mobileSubjectSchema.parse({ userId: 'reader' }) },
        ),
    }
}
function request(path: string, body?: unknown) {
    return new Request('https://leximory.test/api/mobile/v1/' + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { authorization: 'Bearer test' },
        body:
            body === undefined
                ? undefined
                : JSON.stringify(
                      path.endsWith('/remove') && JSON.stringify(body) === '{}' ? { libraryId: 'folder' } : body,
                  ),
    })
}
const fields = {
    title: 'River banks',
    topics: ['Reading'],
    emoji: '🌿',
    content: article.content,
    revision: textRevision(article),
}
const mutations = [
    'texts/article/edit',
    'texts/article/remove',
    'texts/article/ebook-remove',
    'texts/article/ebook-replace?filename=book.pdf',
    'vocabulary/word/remove',
]

test('editing returns lossless source only to its owner and saves canonical fields', async () => {
    const { handler, writes } = harness()
    const response = await handler(request('texts/article/edit'))
    assert.equal(response.status, 200)
    const source = await response.json()
    assert.equal(source.content, article.content)
    assert.equal(source.contentEditable, true)
    assert.equal(source.revision, textRevision(article))
    assert.equal((await handler(request('texts/article/edit', fields))).status, 200)
    assert.deepEqual(writes, [
        { title: fields.title, topics: fields.topics, emoji: fields.emoji, content: fields.content },
    ])
    assert.equal((await handler(request('texts/article/edit', { ...fields, content: 'stale write' }))).status, 409)
    assert.equal(writes.length, 1)
})
test('all management operations require bearer authentication', async () => {
    const { handler, writes } = harness({ authenticated: false })
    for (const path of mutations) assert.equal((await handler(request(path, {}))).status, 401)
    assert.equal((await handler(request('texts/article/edit'))).status, 401)
    assert.deepEqual(writes, [])
})
test('public or starred access never authorizes source access, edits, files, or deletions', async () => {
    for (const access of [1, 2]) {
        const { handler, writes } = harness({
            library: { ...library, owner: 'someone-else', access, starred_by: ['reader'] },
        })
        for (const path of mutations)
            assert.equal(
                (await handler(request(path, path.endsWith('/remove') ? { libraryId: 'folder' } : fields))).status,
                404,
            )
        assert.equal((await handler(request('texts/article/edit'))).status, 404)
        assert.deepEqual(writes, [])
    }
})
test('shadow libraries and link bookmarks cannot be edited as texts', async () => {
    for (const options of [
        { library: { ...library, shadow: true } },
        { text: { ...article, bookmark_url: 'https://example.com' } },
    ]) {
        const { handler, writes } = harness(options)
        for (const path of mutations.filter((path) => path.startsWith('texts/')))
            assert.equal(
                (await handler(request(path, path.endsWith('/remove') ? { libraryId: 'folder' } : fields))).status,
                404,
            )
        assert.deepEqual(writes, [])
    }
})
test('protected welcome words cannot be removed, ordinary words are scoped to their library', async () => {
    const protectedWord = harness({ protected: true })
    assert.equal((await protectedWord.handler(request('vocabulary/word/remove', {}))).status, 404)
    assert.deepEqual(protectedWord.writes, [])
    const { handler, writes } = harness()
    assert.equal((await handler(request('vocabulary/word/remove', { libraryId: 'other', owner: 'fake' }))).status, 400)
    assert.equal((await handler(request('vocabulary/word/remove', {}))).status, 200)
    assert.deepEqual(writes, [['word', 'folder']])
})
test('invalid fields, stale revisions and content limits cause no writes', async () => {
    const { handler, writes } = harness()
    for (const change of [
        { owner: 'other' },
        { title: '' },
        { emoji: 'not emoji' },
        { topics: Array(33).fill('topic') },
        { content: 'a'.repeat(30001) },
    ]) {
        assert.equal((await handler(request('texts/article/edit', { ...fields, ...change }))).status, 400)
    }
    assert.equal((await handler(request('texts/article/edit', { ...fields, revision: 'old' }))).status, 409)
    assert.deepEqual(writes, [])
})
test('ebook and pending-annotation source is retained while metadata remains editable', async () => {
    for (const options of [
        { text: { ...article, has_ebook: true } },
        { progress: 'annotating' },
        { progress: 'saving' },
    ]) {
        const { handler, writes } = harness(options)
        const source = await (await handler(request('texts/article/edit'))).json()
        assert.equal(source.contentEditable, false)
        assert.equal(
            (await handler(request('texts/article/edit', { ...fields, revision: source.revision, content: 'changed' })))
                .status,
            409,
        )
        assert.equal(
            (await handler(request('texts/article/edit', { ...fields, revision: source.revision }))).status,
            200,
        )
        assert.equal(writes.length, 1)
    }
})
test('replacement accepts bounded EPUB/PDF bytes and rejects disguised or empty files before writing', async () => {
    const { handler, writes } = harness({ text: { ...article, has_ebook: true } })
    const upload = (filename: string, bytes: Uint8Array<ArrayBuffer> | string) =>
        handler(
            new Request('https://leximory.test/api/mobile/v1/texts/article/ebook-replace?filename=' + filename, {
                method: 'POST',
                headers: { authorization: 'Bearer test' },
                body: bytes,
            }),
        )
    assert.equal((await upload('book.pdf', '%PDF-1.7')).status, 200)
    assert.equal((await upload('book.EPUB', new Uint8Array([80, 75, 3, 4, 1]))).status, 200)
    assert.equal((await upload('book.pdf', 'fake')).status, 422)
    assert.equal((await upload('book.epub', '')).status, 400)
    assert.equal((await upload('book.exe', '%PDF-1.7')).status, 422)
    assert.equal((await upload('book.pdf', new Uint8Array(4_718_593))).status, 400)
    assert.equal(writes.length, 2)
})
test('file removal preserves the text while text deletion removes the resource', async () => {
    const { handler, writes } = harness({ text: { ...article, has_ebook: true } })
    const detached = await (await handler(request('texts/article/ebook-remove', {}))).json()
    assert.equal(detached.format, 'article')
    assert.equal(detached.id, article.id)
    assert.equal((await handler(request('texts/article/remove', {}))).status, 200)
    assert.deepEqual(writes, [
        ['detach', 'article'],
        ['remove', 'article'],
    ])
})

test('file replacement and removal restore original bytes after upload, cleanup, or publication failures', async () => {
    const { changeEbookFile } = await import('../server/mobile/ebook-file-change')
    for (const failingStage of ['write', 'remove', 'commit']) {
        const original = new Blob(['old EPUB'])
        const values = new Map<string, Blob>([['epub', original]])
        let fail = true
        await assert.rejects(
            changeEbookFile(
                {
                    read: async (extension) => values.get(extension) ?? null,
                    write: async (extension, file) => {
                        if (fail && failingStage === 'write') {
                            fail = false
                            throw new Error('upload')
                        }
                        values.set(extension, file)
                    },
                    remove: async (extension) => {
                        if (fail && failingStage === 'remove') {
                            fail = false
                            throw new Error('cleanup')
                        }
                        values.delete(extension)
                    },
                },
                { extension: 'pdf', file: new Blob(['new PDF']) },
                async () => {
                    if (failingStage === 'commit') throw new Error('metadata')
                },
            ),
        )
        assert.equal(await values.get('epub')?.text(), 'old EPUB')
        assert.equal(values.has('pdf'), false)
    }
})
test('ebook replacement and deletion accept an absent alternate format through the installed Storage SDK', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const { ebookFiles } = await import('../server/mobile/ebook-storage')
    const { changeEbookFile } = await import('../server/mobile/ebook-file-change')
    for (const original of ['pdf', 'epub']) {
        for (const extension of ['pdf', 'epub', null] as const) {
            for (const status of [400, 404]) {
                const requests: string[] = []
                const database = createClient('https://storage.test', 'test-key', {
                    auth: { persistSession: false, autoRefreshToken: false },
                    global: {
                        fetch: async (input, init) => {
                            const url = new URL(String(input))
                            const method = init?.method ?? 'GET'
                            requests.push(method)
                            if (method !== 'GET') return Response.json({})
                            if (url.pathname.endsWith('.' + original)) return new Response('original book')
                            return Response.json(
                                { statusCode: String(status), error: 'not_found', message: 'Object not found' },
                                { status },
                            )
                        },
                    },
                })
                let committed = false
                await changeEbookFile(
                    ebookFiles(database, 'book'),
                    extension === null ? null : { extension, file: new Blob(['replacement']) },
                    async () => {
                        committed = true
                    },
                )
                assert.equal(committed, true)
                assert.deepEqual(
                    requests,
                    extension === null ? ['GET', 'GET', 'DELETE', 'DELETE'] : ['GET', 'GET', 'POST', 'DELETE'],
                )
            }
        }
    }
})
test('ebook file changes stop before writing when Storage fails for reasons other than a missing object', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const { ebookFiles } = await import('../server/mobile/ebook-storage')
    const { changeEbookFile } = await import('../server/mobile/ebook-file-change')
    for (const status of [400, 401, 403, 500]) {
        const requests: string[] = []
        const database = createClient('https://storage.test', 'test-key', {
            auth: { persistSession: false, autoRefreshToken: false },
            global: {
                fetch: async (_input, init) => {
                    requests.push(init?.method ?? 'GET')
                    return Response.json(
                        { statusCode: String(status), message: 'Access denied or unavailable' },
                        { status },
                    )
                },
            },
        })
        await assert.rejects(
            changeEbookFile(ebookFiles(database, 'book'), null, async () => assert.fail('must not commit')),
        )
        assert.deepEqual(requests, ['GET'])
    }
})
test('removing a missing text remains scoped to an owned folder and accepts replay after a lost response', async () => {
    const { handler, writes } = harness()
    assert.equal((await handler(request('texts/article/remove', {}))).status, 200)
    assert.equal((await handler(request('texts/article/remove', {}))).status, 200)
    assert.deepEqual(writes, [['remove', 'article']])
    const foreign = harness({ text: { ...article, lib: 'other-folder' } })
    assert.equal((await foreign.handler(request('texts/article/remove', {}))).status, 404)
    assert.deepEqual(foreign.writes, [])
})
test('generated bodyless file-removal requests work and reject misleading lengths', async () => {
    const { handler } = harness()
    const url = 'https://leximory.test/api/mobile/v1/texts/article/ebook-remove'
    assert.equal(
        (await handler(new Request(url, { method: 'POST', headers: { authorization: 'Bearer test' } }))).status,
        200,
    )
    assert.equal(
        (
            await handler(
                new Request(url, { method: 'POST', headers: { authorization: 'Bearer test', 'content-length': '3' } }),
            )
        ).status,
        400,
    )
})

test('production edit query keeps metadata out of its revision filter through the real Supabase client', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const { editTextRecord } = await import('../server/mobile/text-edit-store')
    for (const topics of [
        null,
        [],
        ['Nature'],
        ['Nature', 'Reading'],
        ['history, geography', 'quote"', 'back\\slash', 'line\nbreak'],
    ] satisfies (string[] | null)[]) {
        let requests = 0
        const database = createClient<import('@repo/supabase/types').Database>('https://database.test', 'test-key', {
            auth: { persistSession: false, autoRefreshToken: false },
            global: {
                fetch: async (input, init) => {
                    requests++
                    const url = new URL(String(input))
                    assert.equal(init?.method, 'PATCH')
                    assert.equal(url.searchParams.get('topics'), null)
                    assert.equal(url.searchParams.get('id'), 'eq.article')
                    assert.equal(url.searchParams.get('lib'), 'eq.folder')
                    assert.equal(url.searchParams.get('content'), null)
                    assert.equal(url.searchParams.get('updated_at'), 'is.null')
                    assert.equal(url.searchParams.get('title'), null)
                    assert.equal(url.searchParams.get('emoji'), null)
                    const { updated_at, ...body } = JSON.parse(String(init?.body))
                    assert.ok(Number.isFinite(Date.parse(updated_at)))
                    assert.deepEqual(body, fieldsWithoutRevision)
                    return Response.json({ ...article, ...fieldsWithoutRevision })
                },
            },
        })
        const fieldsWithoutRevision = {
            title: 'Changed title',
            content: article.content,
            emoji: null,
            topics: ['Updated'],
        }
        const saved = await editTextRecord({ database, text: { ...article, topics }, fields: fieldsWithoutRevision })
        assert.equal(saved.title, 'Changed title')
        assert.deepEqual(saved.topics, ['Updated'])
        assert.equal(requests, 1)
    }
})
test('production edit query preserves conflict detection when the stored row has changed', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const { editTextRecord } = await import('../server/mobile/text-edit-store')
    const database = createClient<import('@repo/supabase/types').Database>('https://database.test', 'test-key', {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
            fetch: async () =>
                Response.json(
                    {
                        code: 'PGRST116',
                        details: 'The result contains 0 rows',
                        message: 'Cannot coerce the result to a single JSON object',
                    },
                    { status: 406 },
                ),
        },
    })
    await assert.rejects(
        editTextRecord({
            database,
            text: article,
            fields: { title: 'Stale title', topics: [], emoji: null, content: article.content },
        }),
        { code: 'stale_revision' },
    )
})
test('ebook replacement cannot turn an article into an ebook', async () => {
    const { handler, writes } = harness()
    const response = await handler(
        new Request('https://leximory.test/api/mobile/v1/texts/article/ebook-replace?filename=book.pdf', {
            method: 'POST',
            headers: { authorization: 'Bearer test' },
            body: '%PDF-1.7',
        }),
    )
    assert.equal(response.status, 422)
    assert.deepEqual(writes, [])
})

test('text edits accept Swift-encoded empty cover emoji and preserve canonical null', async () => {
    const { handler, writes } = harness()
    const { emoji: _, ...swiftPayload } = fields
    assert.equal((await handler(request('texts/article/edit', swiftPayload))).status, 200)
    assert.deepEqual(writes, [{ title: fields.title, topics: fields.topics, content: fields.content, emoji: null }])
})

test('article edits pass through an HTTP server with an 8 KB request-header limit', async () => {
    const { createServer } = await import('node:http')
    const { createClient } = await import('@supabase/supabase-js')
    const { editTextRecord } = await import('../server/mobile/text-edit-store')
    const source = { ...article, content: '河岸旁的树木。'.repeat(3000) }
    let stored: TextRow = source
    let current: TextRow = source
    const server = createServer({ maxHeaderSize: 8192 }, async (request, response) => {
        const chunks: Buffer[] = []
        for await (const chunk of request) chunks.push(Buffer.from(chunk))
        const url = new URL(request.url!, 'http://localhost')
        const expected = stored.updated_at === null ? 'is.null' : 'eq.' + stored.updated_at
        if (url.searchParams.get('updated_at') !== expected) {
            response.writeHead(406, { 'content-type': 'application/json' })
            response.end(JSON.stringify({ code: 'PGRST116', details: 'The result contains 0 rows' }))
            return
        }
        const saved = { ...stored, ...JSON.parse(Buffer.concat(chunks).toString('utf8')) }
        stored = saved
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify(saved))
    })
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(0, '127.0.0.1', resolve)
    })
    try {
        const address = server.address()
        assert.ok(address && typeof address !== 'string')
        const database = createClient<import('@repo/supabase/types').Database>(
            `http://127.0.0.1:${address.port}`,
            'test-key',
            { auth: { persistSession: false, autoRefreshToken: false } },
        )
        for (const content of [source.content, source.content + '\n\nNew paragraph.']) {
            const saved = await editTextRecord({
                database,
                text: current,
                fields: { title: 'Edited article', topics: [], emoji: null, content },
            })
            assert.equal(saved.title, 'Edited article')
            assert.equal(saved.content, content)
            assert.ok(Date.parse(saved.updated_at!) > Date.parse(current.updated_at ?? '1970-01-01'))
            current = saved
        }
        stored = { ...stored, content: stored.content.replace('河', '江'), updated_at: '2099-01-01T00:00:00Z' }
        await assert.rejects(
            editTextRecord({
                database,
                text: current,
                fields: { title: 'Stale overwrite', topics: [], emoji: null, content: current.content },
            }),
            { code: 'stale_revision' },
        )
        assert.ok(stored.content.startsWith('江'))
    } finally {
        server.closeAllConnections()
        await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
    }
})

function persistenceFixture(t: import('node:test').TestContext, failure = '') {
    const reads = [
        { id: 1, location: 'page:12' },
        { id: 2, location: null },
        { id: 3, location: 'page:30' },
    ]
    const bookmarks = [
        { id: 4, location: 'page:8', quote: 'Keep this excerpt' },
        { id: 5, location: null, quote: 'An excerpt without a location' },
    ]
    const files = new Map<string, Blob>([['epub', new Blob(['original EPUB'])]])
    const outlines = new Set(['pdf-outlines/article/version/saved.pdf', 'pdf-outlines/article/old/previous.pdf'])
    const publication = new Map<string, unknown>([
        ['mobile:pdf-outline:pointer', { path: 'pdf-outlines/article/version/saved.pdf', revision: 'saved' }],
        [
            'mobile:pdf-outline:pointer:history',
            {
                before: { path: 'ebooks/article.pdf', digest: 'a' },
                after: { path: 'pdf-outlines/article/version/saved.pdf', digest: 'b' },
            },
        ],
        ['mobile:pdf-outline-receipt:saved', { path: 'ebooks/article.pdf', revision: 'undo' }],
        ['mobile:pdf-outline:other', { path: 'pdf-outlines/other/version/saved.pdf', revision: 'other' }],
    ])
    let deleted = false
    let stored = { ...article, has_ebook: true }
    let failed = false
    const database = createClient<Database>('https://database.test', 'test-key', {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
            fetch: async (input, init) => {
                const url = new URL(String(input))
                if (url.pathname === '/storage/v1/object/list/user-files') {
                    if (!failed && failure === 'outline-list') {
                        failed = true
                        return Response.json({ message: 'listing unavailable' }, { status: 503 })
                    }
                    const { prefix, offset, limit } = JSON.parse(String(init?.body))
                    const children = new Map<string, { id: string | null; name: string }>()
                    for (const path of outlines) {
                        if (!path.startsWith(prefix + '/')) continue
                        const tail = path.slice(prefix.length + 1)
                        const name = tail.split('/')[0]!
                        children.set(name, { name, id: tail.includes('/') ? null : name })
                    }
                    return Response.json([...children.values()].slice(offset, offset + limit))
                }
                if (url.pathname.startsWith('/storage/')) {
                    if (init?.method === 'DELETE') {
                        const paths: string[] = JSON.parse(String(init.body)).prefixes
                        if (
                            !failed &&
                            failure === 'outline-remove' &&
                            paths.some((path) => path.startsWith('pdf-outlines/'))
                        ) {
                            failed = true
                            return Response.json({ message: 'removal unavailable' }, { status: 503 })
                        }
                        for (const key of paths) {
                            if (key.startsWith('pdf-outlines/')) outlines.delete(key)
                            else {
                                const extension = key.split('.').at(-1)
                                assert.ok(extension)
                                files.delete(extension)
                            }
                        }
                        return Response.json([])
                    }
                    const extension = url.pathname.split('.').at(-1)!
                    if (init?.method === 'POST') {
                        const file = init.body instanceof FormData ? init.body.get('') : null
                        assert.ok(file instanceof Blob)
                        files.set(extension, file)
                        return Response.json({ Key: url.pathname })
                    }
                    const file = files.get(extension)
                    return file ? new Response(file) : Response.json({ message: 'Object not found' }, { status: 404 })
                }
                const table = url.pathname.split('/').at(-1)
                assert.equal(url.searchParams.get(table === 'texts' ? 'id' : 'text'), 'eq.article')
                if (init?.method === 'DELETE') {
                    assert.equal(table, 'texts')
                    if (!failed && failure === 'delete-text') {
                        failed = true
                        return Response.json({ code: 'DELETE_FAILED', message: 'rejected' }, { status: 503 })
                    }
                    assert.equal(outlines.size, 0, 'Derived files must be removed before ownership')
                    assert.deepEqual([...publication.keys()], ['mobile:pdf-outline:other'])
                    deleted = true
                    return new Response(null, { status: 204 })
                }
                if (init?.method === 'PATCH') {
                    if (!failed && (failure === table || (failure === 'texts+release' && table === 'texts'))) {
                        failed = true
                        return Response.json({ code: 'WRITE_FAILED', message: table + ' unavailable' }, { status: 503 })
                    }
                    const body = JSON.parse(String(init.body))
                    if (table === 'texts') {
                        assert.equal(url.searchParams.get('lib'), 'eq.folder')
                        assert.equal(url.searchParams.get('bookmark_url'), 'is.null')
                        stored = { ...stored, ...body }
                        return Response.json(stored)
                    }
                    const rows = table === 'reads' ? reads : bookmarks
                    for (const row of rows) {
                        const id = url.searchParams.get('id')
                        if (id?.startsWith('eq.') && id !== 'eq.' + row.id) continue
                        if (id?.startsWith('in.') && !id.slice(4, -1).split(',').includes(String(row.id))) continue
                        if (url.searchParams.get('location') === 'is.null' && row.location !== null) continue
                        if (
                            url.searchParams.get('location')?.startsWith('eq.') &&
                            url.searchParams.get('location') !== 'eq.' + row.location
                        )
                            continue
                        row.location = body.location
                    }
                    return new Response(null, { status: 204 })
                }
                assert.equal(init?.method, 'GET')
                const rows = table === 'reads' ? reads : bookmarks
                return Response.json(
                    rows.filter(
                        (row) => row.location !== null && row.id > Number(url.searchParams.get('id')?.slice(3) ?? 0),
                    ),
                )
            },
        },
    })
    const lease = new Redis({
        url: 'https://lease.fixture.invalid',
        token: 'fixture',
        enableAutoPipelining: false,
        retry: { retries: 0 },
    })
    t.mock.method(globalThis, 'fetch', async (_input: unknown, init?: RequestInit) => {
        const command = JSON.parse(String(init?.body))
        if (command[0].toUpperCase() === 'SET') {
            assert.ok(command.includes(120))
            return Response.json({ result: 'OK' })
        }
        const name = command[0].toUpperCase()
        if (name === 'SCAN') {
            const pattern = command[command.indexOf('match') + 1]
            return Response.json({
                result: [0, [...publication.keys()].filter((key) => key.startsWith(pattern.slice(0, -1)))],
            })
        }
        if (name === 'GET')
            return Response.json({
                result: Buffer.from(JSON.stringify(publication.get(command[1]))).toString('base64'),
            })
        if (name === 'DEL') {
            if (!failed && failure === 'outline-state') {
                failed = true
                return Response.json({ error: 'Redis unavailable' }, { status: 503 })
            }
            for (const key of command.slice(1)) publication.delete(key)
            return Response.json({ result: 1 })
        }
        assert.equal(name, 'EVAL')
        if (failure === 'release' || failure === 'texts+release')
            return Response.json({ error: 'Redis unavailable' }, { status: 503 })
        return Response.json({ result: 1 })
    })
    return {
        store: createManagementStore({ database, lease }),
        reads,
        bookmarks,
        files,
        outlines,
        publication,
        deleted: () => deleted,
        stored: () => stored,
    }
}

test('committed edits succeed even when lease release fails', async (t) => {
    const f = persistenceFixture(t, 'release')
    const saved = await f.store.edit(article, {
        title: 'Saved title',
        topics: [],
        emoji: null,
        content: article.content,
    })
    assert.equal(saved.title, 'Saved title')
    assert.equal(f.stored().title, 'Saved title')
})

test('lease release failure preserves the original mutation failure', async (t) => {
    const f = persistenceFixture(t, 'texts+release')
    await assert.rejects(
        f.store.edit(article, { title: 'Rejected', topics: [], emoji: null, content: article.content }),
        { code: 'WRITE_FAILED' },
    )
})

test('ebook replacement and removal restore locations and bytes when publication fails', async (t) => {
    for (const operation of ['replace', 'remove']) {
        for (const stage of ['reads', 'bookmarks', 'texts']) {
            await t.test(operation + ': ' + stage, async (t) => {
                const f = persistenceFixture(t, stage)
                const before = structuredClone({ reads: f.reads, bookmarks: f.bookmarks })
                await assert.rejects(
                    operation === 'replace'
                        ? f.store.replaceEbook(
                              { ...article, has_ebook: true },
                              new File(['%PDF-new'], 'book.pdf', { type: 'application/pdf' }),
                          )
                        : f.store.removeEbook({ ...article, has_ebook: true }),
                    { code: 'WRITE_FAILED' },
                )
                assert.deepEqual(f.reads, before.reads)
                assert.deepEqual(f.bookmarks, before.bookmarks)
                assert.equal(await f.files.get('epub')?.text(), 'original EPUB')
                assert.equal(f.files.has('pdf'), false)
                assert.equal(f.stored().has_ebook, true)
            })
        }
    }
})

test('successful ebook replacement and removal clear locations and retain excerpts', async (t) => {
    for (const operation of ['replace', 'remove']) {
        await t.test(operation, async (t) => {
            const f = persistenceFixture(t)
            if (operation === 'replace')
                await f.store.replaceEbook(
                    { ...article, has_ebook: true },
                    new File(['%PDF-new'], 'book.pdf', { type: 'application/pdf' }),
                )
            else await f.store.removeEbook({ ...article, has_ebook: true })
            assert.deepEqual(
                f.reads.map((row) => row.location),
                [null, null, null],
            )
            assert.deepEqual(
                f.bookmarks.map((row) => row.location),
                [null, null],
            )
            assert.deepEqual(
                f.bookmarks.map((row) => row.quote),
                ['Keep this excerpt', 'An excerpt without a location'],
            )
            assert.equal(f.stored().has_ebook, operation === 'replace')
            assert.equal(f.files.has('epub'), false)
            assert.equal(f.files.has('pdf'), operation === 'replace')
        })
    }
})

test('text deletion removes derived PDFs and publication state before ownership through the production SDKs', async (t) => {
    const f = persistenceFixture(t)
    await f.store.remove({ ...article, has_ebook: true })
    assert.equal(f.deleted(), true)
    assert.equal(f.files.size, 0)
    assert.equal(f.outlines.size, 0)
    assert.deepEqual([...f.publication.keys()], ['mobile:pdf-outline:other'])
})

for (const stage of ['outline-list', 'outline-remove', 'outline-state', 'delete-text']) {
    test(`text deletion retains ownership and can retry after ${stage} fails`, async (t) => {
        const f = persistenceFixture(t, stage)
        await assert.rejects(f.store.remove({ ...article, has_ebook: true }))
        assert.equal(f.deleted(), false)
        assert.equal(await f.files.get('epub')?.text(), 'original EPUB')
        await f.store.remove({ ...article, has_ebook: true })
        assert.equal(f.deleted(), true)
        assert.equal(f.outlines.size, 0)
    })
}
