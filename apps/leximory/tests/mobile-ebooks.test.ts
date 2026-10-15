import { test } from 'node:test'
import { testMobileHandler } from './helpers/mobile'
import assert from 'node:assert/strict'
import { mobileSubjectSchema } from '@repo/schema/mobile'
import { createEbookOperations, type EbookStore } from '../server/mobile/ebooks'
import { createDefinitionOperations, type DefinitionServices, type Receipt } from '../server/mobile/definitions'
import type { CatalogStore } from '../server/mobile/catalog'

const subject = mobileSubjectSchema.parse({ userId: 'reader' })
const catalog: CatalogStore = {
    library: async () => ({
        id: 'library',
        name: 'Books',
        lang: 'en',
        owner: 'reader',
        access: 0,
        starred_by: null,
        shadow: false,
    }),
    text: async () => ({
        id: 'book',
        lib: 'library',
        title: 'Book',
        content: '',
        no: null,
        created_at: null,
        topics: [],
        emoji: null,
        has_ebook: true,
    }),
    libraries: async () => [],
    texts: async () => [],
    archived: async () => [],
    audio: async () => null,
}
const verify = async () =>
    ({ kind: 'authenticated', subject }) satisfies { kind: 'authenticated'; subject: typeof subject }
function request(operation: string, body?: unknown) {
    return new Request(`https://example.com/api/mobile/v1/texts/book/${operation}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { authorization: 'Bearer verified' },
        body: body === undefined ? undefined : JSON.stringify(body),
    })
}
test('ebook descriptor signs only after authorization and returns user-private web state', async () => {
    const calls: string[] = []
    const ebooks: EbookStore = {
        asset: async (id) => {
            calls.push(id)
            return { url: 'https://example.com/book.epub', format: 'epub' }
        },
        location: async (id, uid) => {
            assert.equal(id, 'book')
            assert.equal(uid, 'reader')
            return 'epubcfi(/6/2!/4/2)'
        },
        bookmarks: async (_id, uid) => {
            assert.equal(uid, 'reader')
            return [{ id: 1, quote: 'bank', chapter: null, location: null, createdAt: null }]
        },
        savePosition: async () => {
            throw Error('unexpected write')
        },
        saveBookmark: async () => {
            throw Error('unexpected write')
        },
        removeBookmark: async () => {
            throw Error('unexpected write')
        },
    }
    const denied = testMobileHandler(
        createEbookOperations({ catalog: { ...catalog, library: async () => null }, ebooks }),
        verify,
    )
    assert.equal((await denied(request('ebook'))).status, 404)
    assert.deepEqual(calls, [])
    const handler = testMobileHandler(createEbookOperations({ catalog, ebooks }), verify)
    const response = await handler(request('ebook'))
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    const payload = await response.json()
    assert.equal(payload.format, 'epub')
    assert.equal(payload.bookmarks.length, 1)
    assert.ok(payload.location.startsWith('epubcfi'))
    assert.equal(payload.document, undefined)
    assert.deepEqual(calls, ['book'])
})
test('ebook position and bookmark writes validate data and derive their owner', async () => {
    const writes: unknown[] = []
    const ebooks: EbookStore = {
        asset: async () => null,
        location: async () => null,
        bookmarks: async () => [],
        savePosition: async (...input) => {
            writes.push(input)
        },
        removeBookmark: async (input) => {
            writes.push(input)
        },
        saveBookmark: async (input) => {
            writes.push(input)
            return { id: 1, quote: input.quote, chapter: input.chapter, location: input.location, createdAt: null }
        },
    }
    const handler = testMobileHandler(createEbookOperations({ catalog, ebooks }), verify)
    assert.equal((await handler(request('ebook-position', { location: '3', userId: 'other' }))).status, 400)
    assert.equal((await handler(request('ebook-position', { location: '3' }))).status, 200)
    assert.equal(
        (await handler(request('ebook-bookmarks', { quote: 'bank', chapter: null, location: '3' }))).status,
        200,
    )
    assert.deepEqual(writes[0], ['book', 'reader', '3'])
    assert.deepEqual(writes[1], { textId: 'book', userId: 'reader', quote: 'bank', chapter: null, location: '3' })
    assert.equal((await handler(request('ebook-bookmark-remove', { bookmarkId: 1, userId: 'other' }))).status, 400)
    assert.equal((await handler(request('ebook-bookmark-remove', { bookmarkId: -1 }))).status, 400)
    const denied = testMobileHandler(
        createEbookOperations({ catalog: { ...catalog, library: async () => null }, ebooks }),
        verify,
    )
    assert.equal((await denied(request('ebook-bookmark-remove', { bookmarkId: 1 }))).status, 404)
    assert.equal(writes.length, 2)
    assert.equal((await handler(request('ebook-bookmark-remove', { bookmarkId: 1 }))).status, 200)
    assert.deepEqual(writes[2], { textId: 'book', userId: 'reader', bookmarkId: 1 })
})
test('ebook lookup applies quota and context validation and saves only its completed receipt', async () => {
    const receipts = new Map<string, Receipt>()
    let charged = 0
    let saved = 0
    const services: DefinitionServices = {
        preferences: async () => ({ accent: 'British English', limit: 20 }),
        cached: async () => null,
        cache: async () => {},
        charge: async () => {
            charged++
            return true
        },
        async *generate(context) {
            assert.equal(context, 'Along the [[bank]].')
            yield '{{bank||bank||河岸}}'
        },
        complete: async (id, receipt) => {
            receipts.set(id, receipt)
        },
        receipt: async (id) => receipts.get(id) ?? null,
        save: async (owner, library) => {
            assert.equal(owner.userId, 'reader')
            assert.equal(library, 'library')
            saved++
            return { id: 'word', libraryId: 'shadow' }
        },
    }
    const handler = testMobileHandler(
        createDefinitionOperations({ store: catalog, services, requestID: () => 'ebook-receipt' }),
        verify,
    )
    assert.equal(
        (await handler(request('ebook-definitions', { quote: 'missing', context: 'Along the bank.', offset: 10 })))
            .status,
        400,
    )
    assert.equal(charged, 0)
    const response = await handler(
        request('ebook-definitions', { quote: 'bank', context: 'Along the bank.', offset: 10 }),
    )
    const frames = (await response.text())
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
    assert.equal(frames.at(-1).kind, 'completed')
    assert.equal(charged, 1)
    assert.equal(
        (await handler(request('ebook-vocabulary', { completionId: 'unknown', requestId: 'save' }))).status,
        400,
    )
    assert.equal(
        (await handler(request('ebook-vocabulary', { completionId: 'ebook-receipt', requestId: 'save' }))).status,
        200,
    )
    assert.equal(saved, 1)
    const receipt = receipts.get('ebook-receipt')!
    receipts.set('ebook-receipt', { ...receipt, subject: 'other' })
    assert.equal(
        (await handler(request('ebook-vocabulary', { completionId: 'ebook-receipt', requestId: 'save' }))).status,
        400,
    )
})

test('ebook repeated words retain the actual selected occurrence', async () => {
    let generated = ''
    const services: DefinitionServices = {
        preferences: async () => ({ accent: 'British English', limit: 20 }),
        cached: async () => null,
        cache: async () => {},
        charge: async () => true,
        async *generate(context) {
            generated = context
            yield '{{bank||bank||河岸}}'
        },
        complete: async () => {},
        receipt: async () => null,
        save: async () => {
            throw Error('unexpected save')
        },
    }
    const handler = testMobileHandler(
        createDefinitionOperations({ store: catalog, services, requestID: () => 'second-bank' }),
        verify,
    )
    const response = await handler(
        request('ebook-definitions', { quote: 'bank', context: 'bank, then another bank', offset: 19 }),
    )
    await response.text()
    assert.equal(generated, 'bank, then another [[bank]]')
})

test('invalid ebook assets are service failures and non-ebook texts cannot write reading state', async () => {
    let writes = 0
    const ebooks: EbookStore = {
        asset: async () => ({ url: 'not-a-url', format: 'epub' }),
        location: async () => null,
        bookmarks: async () => [],
        savePosition: async () => {
            writes++
        },
        saveBookmark: async () => {
            throw Error('unexpected write')
        },
        removeBookmark: async () => {
            throw Error('unexpected write')
        },
    }
    const handler = testMobileHandler(createEbookOperations({ catalog, ebooks }), verify)
    assert.equal((await handler(request('ebook'))).status, 503)
    const articles: CatalogStore = {
        ...catalog,
        text: async (id, signal) => {
            const text = await catalog.text(id, signal)
            assert.ok(text)
            return { ...text, has_ebook: false }
        },
    }
    const articleHandler = testMobileHandler(createEbookOperations({ catalog: articles, ebooks }), verify)
    assert.equal((await articleHandler(request('ebook-position', { location: '3' }))).status, 422)
    assert.equal(writes, 0)
})

test('ebook lookup accepts the full declared Unicode context size', async () => {
    const services: DefinitionServices = {
        preferences: async () => ({ accent: '', limit: 10 }),
        cached: async () => ({ lemma: 'bank', definition: '河岸', etymology: null, cognates: null }),
        cache: async () => {},
        charge: async () => true,
        async *generate() {
            throw new Error('Cached definition should be used')
        },
        complete: async () => {},
        receipt: async () => null,
        save: async () => {
            throw new Error('Lookup should not save')
        },
    }
    const handler = testMobileHandler(createDefinitionOperations({ store: catalog, services }), verify)
    const response = await handler(
        request('ebook-definitions', { quote: 'bank', context: '字'.repeat(3996) + 'bank', offset: 3996 }),
    )
    assert.equal(response.status, 200)
    const frames = (await response.text())
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
    assert.equal(frames.at(-1).kind, 'completed')
})
