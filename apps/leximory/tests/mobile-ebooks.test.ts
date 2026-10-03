import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mobileSubjectSchema } from '@repo/schema/mobile'
import { createEbookHandler, type EbookStore } from '../server/mobile/ebooks'
import { createDefinitionHandler, type DefinitionServices, type Receipt } from '../server/mobile/definitions'
import type { CatalogStore } from '../server/mobile/catalog'

const subject = mobileSubjectSchema.parse({ userId: 'reader' })
const catalog: CatalogStore = {
    library: async () => ({ id: 'library', name: 'Books', lang: 'en', owner: 'reader', access: 0, starred_by: null, shadow: false }),
    text: async () => ({ id: 'book', lib: 'library', title: 'Book', content: '', no: null, created_at: null, topics: [], emoji: null, has_ebook: true }),
    libraries: async () => [], texts: async () => [], archived: async () => [], audio: async () => null,
}
const verify = async () => ({ kind: 'authenticated', subject } satisfies { kind: 'authenticated'; subject: typeof subject })
function request(operation: string, body?: unknown) {
    return new Request(`https://example.com/api/mobile/v1/texts/book/${operation}`, {
        method: body === undefined ? 'GET' : 'POST', headers: { authorization: 'Bearer verified' },
        body: body === undefined ? undefined : JSON.stringify(body),
    })
}
test('ebook descriptor signs only after authorization and returns user-private web state', async () => {
    const calls: string[] = []
    const ebooks: EbookStore = {
        asset: async id => { calls.push(id); return { url: 'https://example.com/book.epub', format: 'epub' } },
        location: async (id, uid) => { assert.equal(id, 'book'); assert.equal(uid, 'reader'); return 'epubcfi(/6/2!/4/2)' },
        bookmarks: async (_id, uid) => { assert.equal(uid, 'reader'); return [{ id: 1, quote: 'bank', chapter: null, location: null, createdAt: null }] },
        savePosition: async () => { throw Error('unexpected write') }, saveBookmark: async () => { throw Error('unexpected write') },
    }
    const denied = createEbookHandler({ verify, catalog: { ...catalog, library: async () => null }, ebooks })
    assert.equal((await denied(request('ebook'))).status, 404); assert.deepEqual(calls, [])
    const handler = createEbookHandler({ verify, catalog, ebooks })
    const response = await handler(request('ebook'))
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store')
    const payload = await response.json()
    assert.equal(payload.format, 'epub'); assert.equal(payload.bookmarks.length, 1); assert.ok(payload.location.startsWith('epubcfi'))
    assert.equal(payload.document, undefined); assert.deepEqual(calls, ['book'])
})
test('ebook position and bookmark writes validate data and derive their owner', async () => {
    const writes: unknown[] = []
    const ebooks: EbookStore = {
        asset: async () => null, location: async () => null, bookmarks: async () => [],
        savePosition: async (...input) => { writes.push(input) },
        saveBookmark: async input => { writes.push(input); return { id: 1, quote: input.quote, chapter: input.chapter, location: input.location, createdAt: null } },
    }
    const handler = createEbookHandler({ verify, catalog, ebooks })
    assert.equal((await handler(request('ebook-position', { location: '3', userId: 'other' }))).status, 400)
    assert.equal((await handler(request('ebook-position', { location: '3' }))).status, 200)
    assert.equal((await handler(request('ebook-bookmarks', { quote: 'bank', chapter: null, location: '3' }))).status, 200)
    assert.deepEqual(writes[0], ['book', 'reader', '3'])
    assert.deepEqual(writes[1], { textId: 'book', userId: 'reader', quote: 'bank', chapter: null, location: '3' })
})
test('ebook lookup applies quota and context validation and saves only its completed receipt', async () => {
    const receipts = new Map<string, Receipt>(); let charged = 0; let saved = 0
    const services: DefinitionServices = {
        preferences: async () => ({ accent: 'British English', limit: 20 }), cached: async () => null, cache: async () => {},
        charge: async () => { charged++; return true },
        async *generate(context) { assert.equal(context, 'Along the [[bank]].'); yield '{{bank||bank||河岸}}' },
        complete: async (id, receipt) => { receipts.set(id, receipt) }, receipt: async id => receipts.get(id) ?? null,
        save: async (owner, library) => { assert.equal(owner.userId, 'reader'); assert.equal(library, 'library'); saved++; return { id: 'word', libraryId: 'shadow' } },
    }
    const handler = createDefinitionHandler({ verify, store: catalog, services, requestID: () => 'ebook-receipt' })
    assert.equal((await handler(request('ebook-definitions', { quote: 'missing', context: 'Along the bank.', offset: 10 }))).status, 400)
    assert.equal(charged, 0)
    const response = await handler(request('ebook-definitions', { quote: 'bank', context: 'Along the bank.', offset: 10 }))
    const frames = (await response.text()).trim().split('\n').map(line => JSON.parse(line))
    assert.equal(frames.at(-1).kind, 'completed'); assert.equal(charged, 1)
    assert.equal((await handler(request('ebook-vocabulary', { completionId: 'unknown' }))).status, 400)
    assert.equal((await handler(request('ebook-vocabulary', { completionId: 'ebook-receipt' }))).status, 200)
    assert.equal(saved, 1)
    const receipt = receipts.get('ebook-receipt')!
    receipts.set('ebook-receipt', { ...receipt, subject: 'other' })
    assert.equal((await handler(request('ebook-vocabulary', { completionId: 'ebook-receipt' }))).status, 400)
})


test('ebook repeated words retain the actual selected occurrence', async () => {
    let generated = ''
    const services: DefinitionServices = {
        preferences: async () => ({ accent: 'British English', limit: 20 }), cached: async () => null, cache: async () => {},
        charge: async () => true, async *generate(context) { generated = context; yield '{{bank||bank||河岸}}' },
        complete: async () => {}, receipt: async () => null, save: async () => { throw Error('unexpected save') },
    }
    const handler = createDefinitionHandler({ verify, store: catalog, services, requestID: () => 'second-bank' })
    const response = await handler(request('ebook-definitions', { quote: 'bank', context: 'bank, then another bank', offset: 19 }))
    await response.text()
    assert.equal(generated, 'bank, then another [[bank]]')
})
