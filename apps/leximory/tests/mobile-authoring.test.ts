import { createHash } from 'node:crypto'
import { createEbookStaging } from '../server/mobile/ebook-staging'
import { createEbookUploadOperations, type EbookStaging } from '../server/mobile/ebook-upload'
import { serializeWord } from '../server/mobile/word-format'
import { test } from 'node:test'
import { testMobileHandler } from './helpers/mobile'
import { assertPublicArticleURL } from '../server/mobile/article-url'
import assert from 'node:assert/strict'
import { mobileSubjectSchema } from '@repo/schema/mobile'
import { createAuthoringOperations, type AuthoringStore } from '../server/mobile/authoring'
import type { CatalogStore } from '../server/mobile/catalog'
import { MobileError } from '../server/mobile/errors'
import { createClient } from '@supabase/supabase-js'
import { Redis } from '@upstash/redis'
import type { Database } from '@repo/supabase/types'
import { createEbookImporter } from '../server/mobile/ebook-import-persistence'
import { textRowSchema, type TextRow } from '../server/mobile/catalog'
const subject = mobileSubjectSchema.parse({ userId: 'reader' })
const fields = { original: 'banks', lemma: 'bank', definition: '河岸', etymology: '古英语', cognates: 'embankment' }
const word = { id: 'word', libraryId: 'library', fields }
const catalog: CatalogStore = {
    library: async () => ({
        id: 'library',
        name: '书',
        lang: 'en',
        owner: 'reader',
        access: 0,
        starred_by: null,
        shadow: false,
    }),
    text: async () => null,
    libraries: async () => [],
    texts: async () => [],
    archived: async () => [],
    audio: async () => null,
}
function harness(store: Partial<AuthoringStore> = {}, owner = catalog, staging?: EbookStaging) {
    const writes: unknown[] = []
    const authoring: AuthoringStore = {
        word: async () => word,
        words: async () => ({ items: [word], nextCursor: null }),
        updateWord: async (...args) => {
            writes.push(args)
        },
        article: async (_subject, library, input) => {
            writes.push(input)
            return {
                id: 'article',
                libraryId: library.id,
                title: input.title,
                topics: [],
                emoji: null,
                createdAt: null,
                format: 'article',
            }
        },
        ebook: async (library, { title, upload: { file } }) => {
            writes.push({ title, type: file.type, size: file.size })
            return {
                created: true,
                text: {
                    id: 'ebook',
                    libraryId: library.id,
                    title,
                    topics: [],
                    emoji: null,
                    createdAt: null,
                    format: 'ebook',
                },
            }
        },
        chooseEbookEmoji: async () => '🪐',
        setEbookEmoji: async () => {},
        ...store,
    }
    return {
        writes,
        handler: testMobileHandler(
            {
                ...createAuthoringOperations({ catalog: owner, authoring, staging }),
                ...(staging ? createEbookUploadOperations({ catalog: owner, staging }) : {}),
            },
            async () => ({
                kind: 'authenticated',
                subject,
            }),
        ),
    }
}
function request(path: string, body?: unknown) {
    return new Request(`https://example.com/api/mobile/v1/${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { authorization: 'Bearer test' },
        body: body === undefined ? undefined : JSON.stringify(body),
    })
}
function ebookUpload(filename: string, bytes: Uint8Array<ArrayBuffer> | string, title = 'Book', requestId?: string) {
    const parameters = new URLSearchParams({ title, filename })
    if (requestId) parameters.set('requestId', requestId)
    return new Request(`https://example.com/api/mobile/v1/libraries/library/ebooks?${parameters}`, {
        method: 'POST',
        headers: { authorization: 'Bearer test', 'content-type': 'application/octet-stream' },
        body: bytes,
    })
}
test('ebook upload replays a lost publication response without another text or file', async (t) => {
    const rows = new Map<string, TextRow>()
    const uploaded: string[] = []
    const database = createClient<Database>('https://database.test', 'fixture', {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
            fetch: async (input, init) => {
                const url = new URL(String(input))
                if (url.pathname.startsWith('/storage/v1/object/user-files/ebooks/')) {
                    assert.equal(init?.method, 'POST')
                    assert.ok(init?.body instanceof FormData)
                    const file = init.body.get('')
                    assert.ok(file instanceof Blob)
                    assert.equal(await file.text(), '%PDF-new')
                    uploaded.push(url.pathname.split('/').at(-1)!)
                    return Response.json({ Key: url.pathname })
                }
                assert.equal(url.pathname, '/rest/v1/texts')
                if (init?.method === 'POST') {
                    const saved = textRowSchema.parse({
                        topics: [],
                        emoji: null,
                        created_at: null,
                        updated_at: null,
                        no: null,
                        ...JSON.parse(String(init.body)),
                    })
                    rows.set(saved.id, saved)
                    throw new TypeError('Lost committed ebook response')
                }
                assert.equal(init?.method, 'GET')
                const row = rows.get(url.searchParams.get('id')?.slice(3) ?? '')
                return Response.json(row ? [row] : [])
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
        const [command] = JSON.parse(String(init?.body))
        return Response.json({ result: command.toUpperCase() === 'SET' ? 'OK' : 1 })
    })
    const { handler } = harness({ ebook: createEbookImporter({ database, lease }) })
    const upload = () => ebookUpload('book.pdf', '%PDF-new', 'Book', 'same-upload')
    assert.equal((await handler(upload())).status, 503)
    const replay = await handler(upload())
    assert.equal(replay.status, 200)
    const book = await replay.json()
    assert.equal(book.title, 'Book')
    assert.equal(book.format, 'ebook')
    assert.deepEqual([...rows.keys()], [book.id])
    assert.deepEqual(uploaded, [book.id + '.pdf'])
})
test('saved words load, edit the canonical fields, and preserve the destination library', async () => {
    const { handler, writes } = harness()
    assert.deepEqual(await (await handler(request('vocabulary/word'))).json(), word)
    assert.equal((await handler(request('vocabulary/word', { ...fields, definition: '河堤' }))).status, 200)
    assert.deepEqual(writes, [['word', 'library', { ...fields, definition: '河堤' }]])
    assert.equal(serializeWord({ ...fields, etymology: null }), '{{banks||bank||河岸||||embankment}}')
})
test('read access alone never grants word edits or content uploads', async () => {
    const { handler, writes } = harness(
        {},
        {
            ...catalog,
            library: async () => ({
                id: 'library',
                name: '共享',
                lang: 'en',
                owner: 'other',
                access: 1,
                starred_by: ['reader'],
                shadow: false,
            }),
        },
    )
    for (const path of [
        'vocabulary/word',
        'libraries/library/articles',
        'libraries/library/ebooks?title=Book&filename=book.pdf',
    ]) {
        assert.equal((await handler(request(path, fields))).status, 404)
    }
    assert.deepEqual(writes, [])
})
test('edits reject injected delimiters and extra owner fields before writing', async () => {
    const { handler, writes } = harness()
    for (const body of [
        { ...fields, definition: 'bad||value' },
        { ...fields, definition: '  ' },
        { ...fields, userId: 'other' },
    ]) {
        assert.equal((await handler(request('vocabulary/word', body))).status, 400)
    }
    assert.deepEqual(writes, [])
})
test('vocabulary listing validates its response and never accepts uploads', async () => {
    const { handler, writes } = harness()
    assert.deepEqual(await (await handler(request('libraries/library/vocabulary'))).json(), {
        items: [word],
        nextCursor: null,
    })
    assert.equal(
        (await handler(request('libraries/library/vocabulary?title=Book&filename=book.pdf', fields))).status,
        405,
    )
    assert.deepEqual(writes, [])
})
test('invalid stored vocabulary is a service failure, not a client validation error', async () => {
    const { handler } = harness({
        words: async () => ({ items: [{ ...word, fields: { ...fields, lemma: '' } }], nextCursor: null }),
    })
    assert.equal((await handler(request('libraries/library/vocabulary'))).status, 503)
})
test('article upload passes generation settings, validates language length, and derives the owner', async () => {
    const { handler, writes } = harness()
    const input = {
        title: 'Article',
        content: 'Along the river.',
        annotate: true,
        onlyComments: false,
        generateTitle: true,
    }
    assert.equal((await handler(request('libraries/library/articles', input))).status, 200)
    assert.deepEqual(writes, [input])
    const chinese = harness(
        {},
        { ...catalog, library: async (id, signal) => ({ ...(await catalog.library(id, signal))!, lang: 'zh' }) },
    )
    assert.equal(
        (await chinese.handler(request('libraries/library/articles', { ...input, content: '字'.repeat(5001) }))).status,
        400,
    )
    assert.deepEqual(chinese.writes, [])
    const french = harness(
        {},
        { ...catalog, library: async (id, signal) => ({ ...(await catalog.library(id, signal))!, lang: 'fr' }) },
    )
    assert.equal(
        (await french.handler(request('libraries/library/articles', { ...input, content: 'a'.repeat(20000) }))).status,
        200,
    )
    assert.equal(
        (await french.handler(request('libraries/library/articles', { ...input, content: 'a'.repeat(30001) }))).status,
        400,
    )
})
test('PDF/EPUB streams enforce size and signatures before storage', async () => {
    const { handler, writes } = harness()
    assert.equal((await handler(ebookUpload('book.pdf', '%PDF-1.7\nexample'))).status, 200)
    assert.equal((await handler(ebookUpload('book.EPUB', new Uint8Array([0x50, 0x4b, 3, 4, 0])))).status, 200)
    assert.equal((await handler(ebookUpload('book.pdf', 'not a pdf'))).status, 422)
    assert.equal((await handler(ebookUpload('book.exe', 'not a book'))).status, 422)
    assert.equal((await handler(ebookUpload('empty.pdf', ''))).status, 400)
    assert.equal((await handler(ebookUpload('huge.pdf', new Uint8Array(4_718_593)))).status, 400)
    assert.equal(writes.length, 2)
})

test('EPUB and PDF imports choose, persist, and return an emoji using the bearer owner and book metadata', async () => {
    for (const file of [
        { filename: '宇宙 & planets.pdf', bytes: '%PDF-1.7\nexample' },
        { filename: 'Cosmos.EPUB', bytes: new Uint8Array([0x50, 0x4b, 3, 4, 0]) },
    ]) {
        const steps: unknown[] = []
        const { handler, writes } = harness({
            chooseEbookEmoji: async (owner, input) => {
                assert.equal(writes.length, 1, 'the book must be saved before emoji generation')
                steps.push({ owner, input })
                return '🪐'
            },
            setEbookEmoji: async (id, emoji) => {
                steps.push({ id, emoji })
            },
        })
        const response = await handler(ebookUpload(file.filename, file.bytes, '  Cosmos  '))
        assert.equal(response.status, 200)
        assert.deepEqual(await response.json(), {
            id: 'ebook',
            libraryId: 'library',
            title: 'Cosmos',
            topics: [],
            emoji: '🪐',
            createdAt: null,
            format: 'ebook',
        })
        assert.deepEqual(steps, [
            { owner: subject, input: { title: 'Cosmos', filename: file.filename } },
            { id: 'ebook', emoji: '🪐' },
        ])
    }
})

test('invalid emoji choices never overwrite an imported book', async () => {
    for (const emoji of ['', 'a planet', '🪐🌍']) {
        const saved: unknown[] = []
        const { handler, writes } = harness({
            chooseEbookEmoji: async () => emoji,
            setEbookEmoji: async (...args) => {
                saved.push(args)
            },
        })
        const response = await handler(ebookUpload('book.pdf', '%PDF-1.7\nexample'))
        assert.equal(response.status, 200)
        assert.equal((await response.json()).emoji, null)
        assert.equal(writes.length, 1)
        assert.deepEqual(saved, [])
    }
})

test('quota, generation, timeout, and emoji persistence failures keep the successful ebook import', async (t) => {
    t.mock.method(console, 'error', () => {})
    for (const failure of ['quota', 'generation', 'timeout', 'persistence']) {
        const saved: unknown[] = []
        const { handler, writes } = harness({
            chooseEbookEmoji: async () => {
                if (failure === 'quota') throw new MobileError('quota_exceeded')
                if (failure === 'generation') throw new Error('Provider unavailable')
                if (failure === 'timeout') throw new DOMException('Emoji generation timed out', 'TimeoutError')
                return '🪐'
            },
            setEbookEmoji: async (...args) => {
                saved.push(args)
                throw new Error('Database unavailable')
            },
        })
        const response = await handler(ebookUpload('book.pdf', '%PDF-1.7\nexample'))
        assert.equal(response.status, 200)
        const imported = await response.json()
        assert.equal(imported.id, 'ebook')
        assert.equal(imported.emoji, null)
        assert.equal(writes.length, 1)
        assert.deepEqual(saved, failure === 'persistence' ? [['ebook', '🪐']] : [])
    }
})

test('rejected and failed uploads never attempt emoji assignment', async () => {
    const attempts: string[] = []
    const { handler } = harness({
        ebook: async () => {
            throw new MobileError('service_unavailable')
        },
        chooseEbookEmoji: async () => {
            attempts.push('choose')
            return '🪐'
        },
        setEbookEmoji: async () => {
            attempts.push('save')
        },
    })
    assert.equal((await handler(ebookUpload('book.pdf', 'invalid'))).status, 422)
    assert.equal((await handler(ebookUpload('book.pdf', '%PDF-1.7\nexample'))).status, 503)
    assert.deepEqual(attempts, [])
})

test('shared corpus allows reading while protected welcome words cannot be edited', async () => {
    const shared: CatalogStore = {
        ...catalog,
        library: async () => ({
            id: 'library',
            name: '共享',
            lang: 'en',
            owner: 'other',
            access: 1,
            starred_by: ['reader'],
            shadow: false,
        }),
    }
    const { handler } = harness({}, shared)
    assert.equal((await handler(request('libraries/library/vocabulary'))).status, 200)
    assert.equal((await handler(request('vocabulary/word'))).status, 200)
    const protectedWord = harness({ word: async () => ({ ...word, protected: true }) })
    assert.equal((await protectedWord.handler(request('vocabulary/word', fields))).status, 404)
    assert.deepEqual(protectedWord.writes, [])
})
test('URL preview autofills without importing or annotation quota side effects', async () => {
    const { handler, writes } = harness({ extract: async () => ({ title: 'Article', content: 'Along the river.' }) })
    const response = await handler(request('libraries/library/article-preview', { url: 'https://example.org/article' }))
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { title: 'Article', content: 'Along the river.' })
    assert.deepEqual(writes, [])
    assert.equal((await handler(request('libraries/library/article-preview', { url: 'invalid' }))).status, 400)
})

test('article preview rejects private networks and embedded credentials', async () => {
    for (const url of [
        'http://127.0.0.1/a',
        'http://[::1]/',
        'http://192.168.1.1/',
        'http://10.1.1.1/',
        'http://localhost/',
        'file:///tmp/a',
        'https://user:secret@example.org/',
    ]) {
        await assert.rejects(assertPublicArticleURL(url))
    }
    await assert.doesNotReject(assertPublicArticleURL('https://8.8.8.8/article'))
})

test('vocabulary results must belong to the authorized library and requested word', async () => {
    const foreignPage = harness({ words: async () => ({ items: [{ ...word, libraryId: 'other' }], nextCursor: null }) })
    assert.equal((await foreignPage.handler(request('libraries/library/vocabulary'))).status, 503)
    const wrongWord = harness({ word: async () => ({ ...word, id: 'other' }) })
    assert.equal((await wrongWord.handler(request('vocabulary/word'))).status, 503)
})

test('word edits accept full Unicode fields but bound the request before writing', async () => {
    const { handler, writes } = harness()
    const unicode = {
        ...fields,
        definition: '字'.repeat(16000),
        etymology: '字'.repeat(16000),
        cognates: '字'.repeat(16000),
    }
    assert.equal((await handler(request('vocabulary/word', unicode))).status, 200)
    assert.equal((await handler(request('vocabulary/word', { ...fields, definition: 'x'.repeat(320001) }))).status, 400)
    assert.equal(writes.length, 1)
})

test('vocabulary rejects duplicate and unsupported pagination query parameters', async () => {
    const { handler } = harness()
    for (const parameters of ['cursor=1&cursor=2', 'cursor=invalid', 'owner=other']) {
        assert.equal((await handler(request(`libraries/library/vocabulary?${parameters}`))).status, 400)
    }
})

test('word serialization retains empty middle fields instead of moving cognates into etymology', () => {
    assert.equal(
        serializeWord({ original: 'bank', lemma: 'bank', definition: '河岸', etymology: null, cognates: 'embankment' }),
        '{{bank||bank||河岸||||embankment}}',
    )
})

test('a 15 MB staging grant requires current paid access and publishes only the authorized bytes', async (t) => {
    const bytes = Buffer.alloc(15_000_000)
    bytes.write('%PDF-1.7')
    let stored: Uint8Array<ArrayBuffer> | null = null
    let signedPath: string | undefined
    const database = createClient<Database>('https://project.supabase.co', 'fixture-service', {
        global: {
            fetch: async (input, init) => {
                const path = new URL(String(input)).pathname
                if (path === '/storage/v1/bucket/mobile-ebook-uploads') {
                    return Response.json({
                        public: false,
                        file_size_limit: 15_000_000,
                        allowed_mime_types: ['application/pdf', 'application/epub+zip'],
                    })
                }
                if (path.startsWith('/storage/v1/object/upload/sign/mobile-ebook-uploads/')) {
                    assert.equal(init?.method, 'POST')
                    assert.equal(new Headers(init?.headers).get('x-upsert'), null)
                    signedPath = path.split('/').at(-1)
                    return Response.json({ url: path.replace('/storage/v1', '') + '?token=fixture-token' })
                }
                if (path === '/storage/v1/object/info/mobile-ebook-uploads/' + signedPath) {
                    return stored
                        ? Response.json({ size: stored.byteLength })
                        : Response.json({ statusCode: '404', message: 'Object not found' }, { status: 404 })
                }
                if (path === '/storage/v1/object/mobile-ebook-uploads/' + signedPath && stored)
                    return new Response(stored)
                assert.fail('Unexpected Supabase path ' + path)
            },
        },
    })
    const redis = new Redis({
        url: 'https://redis.fixture.invalid',
        token: 'fixture',
        enableAutoPipelining: false,
        retry: { retries: 0 },
    })
    const redisValues = new Map<string, string>()
    t.mock.method(globalThis, 'fetch', async (_input: unknown, init?: RequestInit) => {
        const [command, key, value] = JSON.parse(String(init?.body))
        switch (command.toUpperCase()) {
            case 'GET':
                return Response.json({ result: redisValues.get(key) ?? null })
            case 'SET':
                redisValues.set(key, value)
                return Response.json({ result: 'OK' })
            case 'EVAL':
                return Response.json({ result: 1 })
            default:
                assert.fail('Unexpected Redis operation ' + command)
        }
    })
    let status: 'active' | 'expired' = 'expired'
    const { staging } = createEbookStaging({
        database,
        redis,
        endpoint: 'https://project.supabase.co',
        publicKey: 'fixture-public',
        getMembership: async () => ({
            legacyPlan: 'beginner',
            plan: status === 'active' ? 'bilingual' : 'beginner',
            memberships: [
                {
                    provider: 'appStore',
                    status,
                    plan: 'bilingual',
                    autoRenews: true,
                    expiresAt: '2026-12-01T00:00:00Z',
                },
            ],
            purchaseEligible: status === 'expired',
        }),
    })
    const { handler, writes } = harness({}, catalog, staging)
    const metadata = {
        kind: 'import',
        targetId: 'library',
        filename: 'book.pdf',
        title: 'Book',
        requestId: 'large-book',
        size: bytes.byteLength,
        sha256: createHash('sha256').update(bytes).digest('hex'),
    }
    const prepare = (input = metadata) => handler(request('ebook-upload-grants', input))
    const unauthorized = await prepare()
    assert.equal(unauthorized.status, 403)
    assert.deepEqual((await unauthorized.json()).error, {
        code: 'ebook_subscription_required',
        message: '免费方案电子书最大 4.5 MB',
        retryable: false,
    })
    assert.equal(signedPath, undefined)
    status = 'active'
    const oversized = await prepare({ ...metadata, size: 15_000_001 })
    assert.equal(oversized.status, 413)
    assert.deepEqual((await oversized.json()).error, {
        code: 'ebook_file_too_large',
        message: '电子书超过上限 15 MB',
        retryable: false,
    })
    const grant = await (await prepare()).json()
    assert.deepEqual(grant.upload, {
        url: 'https://project.storage.supabase.co/storage/v1/upload/resumable/sign',
        bucket: 'mobile-ebook-uploads',
        path: signedPath,
        token: 'fixture-token',
        publicKey: 'fixture-public',
    })
    const finalize = (title = 'Book') =>
        handler(
            request(
                'libraries/library/ebooks?' +
                    new URLSearchParams({
                        title,
                        filename: 'book.pdf',
                        requestId: 'large-book',
                        uploadId: grant.id,
                    }),
                {},
            ),
        )
    assert.equal((await finalize()).status, 503)
    stored = Buffer.from(bytes)
    stored[stored.length - 1] = 1
    assert.equal((await finalize()).status, 400)
    stored = bytes
    status = 'expired'
    assert.equal((await finalize()).status, 403)
    status = 'active'
    assert.equal((await finalize('Other title')).status, 400)
    assert.deepEqual(writes, [])
    assert.deepEqual(await (await prepare()).json(), { id: grant.id, upload: null })
    assert.equal((await finalize()).status, 200)
    assert.deepEqual(writes, [{ title: 'Book', type: 'application/pdf', size: 15_000_000 }])
})
