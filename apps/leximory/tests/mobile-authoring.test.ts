import { test } from 'node:test'
import { assertPublicArticleURL } from '../server/mobile/article-url'
import assert from 'node:assert/strict'
import { mobileSubjectSchema } from '@repo/schema/mobile'
import { createAuthoringHandler, serializeWord, type AuthoringStore } from '../server/mobile/authoring'
import type { CatalogStore } from '../server/mobile/catalog'
const subject = mobileSubjectSchema.parse({ userId: 'reader' })
const fields = { original: 'banks', lemma: 'bank', definition: '河岸', etymology: '古英语', cognates: 'embankment' }
const word = { id: 'word', libraryId: 'library', fields }
const catalog: CatalogStore = {
    library: async () => ({ id: 'library', name: '书', lang: 'en', owner: 'reader', access: 0, starred_by: null, shadow: false }),
    text: async () => null, libraries: async () => [], texts: async () => [], archived: async () => [], audio: async () => null,
}
function harness(store: Partial<AuthoringStore> = {}, owner = catalog) {
    const writes: unknown[] = []
    const authoring: AuthoringStore = {
        word: async () => word, words: async () => ({ items: [word], nextCursor: null }),
        updateWord: async (...args) => { writes.push(args) },
        article: async (_subject, library, input) => { writes.push(input); return { id: 'article', libraryId: library.id, title: input.title, topics: [], emoji: null, createdAt: null, format: 'article' } },
        ebook: async (library, title, file) => { writes.push({ title, type: file.type, size: file.size }); return { id: 'ebook', libraryId: library.id, title, topics: [], emoji: null, createdAt: null, format: 'ebook' } },
        ...store,
    }
    return { writes, handler: createAuthoringHandler({ verify: async () => ({ kind: 'authenticated', subject }), catalog: owner, authoring }) }
}
function request(path: string, body?: unknown) {
    return new Request(`https://example.com/api/mobile/v1/${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: 'Bearer test' }, body: body === undefined ? undefined : JSON.stringify(body) })
}
test('saved words load, edit the canonical fields, and preserve the destination library', async () => {
    const { handler, writes } = harness()
    assert.deepEqual(await (await handler(request('vocabulary/word'))).json(), word)
    assert.equal((await handler(request('vocabulary/word', { ...fields, definition: '河堤' }))).status, 200)
    assert.deepEqual(writes, [['word', 'library', { ...fields, definition: '河堤' }]])
    assert.equal(serializeWord({ ...fields, etymology: null }), '{{banks||bank||河岸||||embankment}}')
})
test('read access alone never grants word edits or content uploads', async () => {
    const { handler, writes } = harness({}, { ...catalog, library: async () => ({ id: 'library', name: '共享', lang: 'en', owner: 'other', access: 1, starred_by: ['reader'], shadow: false }) })
    for (const path of ['vocabulary/word', 'libraries/library/articles', 'libraries/library/ebooks?title=Book&filename=book.pdf']) {
        assert.equal((await handler(request(path, fields))).status, 404)
    }
    assert.deepEqual(writes, [])
})
test('edits reject injected delimiters and extra owner fields before writing', async () => {
    const { handler, writes } = harness()
    for (const body of [{ ...fields, definition: 'bad||value' }, { ...fields, definition: '  ' }, { ...fields, userId: 'other' }]) {
        assert.equal((await handler(request('vocabulary/word', body))).status, 400)
    }
    assert.deepEqual(writes, [])
})
test('vocabulary listing validates its response and never accepts uploads', async () => {
    const { handler, writes } = harness()
    assert.deepEqual(await (await handler(request('libraries/library/vocabulary'))).json(), { items: [word], nextCursor: null })
    assert.equal((await handler(request('libraries/library/vocabulary?title=Book&filename=book.pdf', fields))).status, 404)
    assert.deepEqual(writes, [])
})
test('invalid stored vocabulary is a service failure, not a client validation error', async () => {
    const { handler } = harness({ words: async () => ({ items: [{ ...word, fields: { ...fields, lemma: '' } }], nextCursor: null }) })
    assert.equal((await handler(request('libraries/library/vocabulary'))).status, 503)
})
test('article upload passes generation settings, validates language length, and derives the owner', async () => {
    const { handler, writes } = harness()
    const input = { title: 'Article', content: 'Along the river.', annotate: true, onlyComments: false, generateTitle: true }
    assert.equal((await handler(request('libraries/library/articles', input))).status, 200)
    assert.deepEqual(writes, [input])
    const chinese = harness({}, { ...catalog, library: async (id, signal) => ({ ...(await catalog.library(id, signal))!, lang: 'zh' }) })
    assert.equal((await chinese.handler(request('libraries/library/articles', { ...input, content: '字'.repeat(5001) }))).status, 400)
    assert.deepEqual(chinese.writes, [])
    const french = harness({}, { ...catalog, library: async (id, signal) => ({ ...(await catalog.library(id, signal))!, lang: 'fr' }) })
    assert.equal((await french.handler(request('libraries/library/articles', { ...input, content: 'a'.repeat(20000) }))).status, 200)
    assert.equal((await french.handler(request('libraries/library/articles', { ...input, content: 'a'.repeat(30001) }))).status, 400)
})
test('PDF/EPUB streams enforce size and signatures before storage', async () => {
    const { handler, writes } = harness()
    const upload = (name: string, bytes: Uint8Array<ArrayBuffer> | string) => new Request(`https://example.com/api/mobile/v1/libraries/library/ebooks?title=Book&filename=${name}`, {
        method: 'POST', headers: { authorization: 'Bearer test', 'content-type': 'application/octet-stream' }, body: bytes,
    })
    assert.equal((await handler(upload('book.pdf', '%PDF-1.7\nexample'))).status, 200)
    assert.equal((await handler(upload('book.EPUB', new Uint8Array([0x50, 0x4b, 3, 4, 0])))).status, 200)
    assert.equal((await handler(upload('book.pdf', 'not a pdf'))).status, 422)
    assert.equal((await handler(upload('book.exe', 'not a book'))).status, 422)
    assert.equal((await handler(upload('empty.pdf', ''))).status, 400)
    assert.equal((await handler(upload('huge.pdf', new Uint8Array(4_718_593)))).status, 400)
    assert.equal(writes.length, 2)
})

test('shared corpus allows reading while protected welcome words cannot be edited', async () => {
    const shared: CatalogStore = { ...catalog, library: async () => ({ id: 'library', name: '共享', lang: 'en', owner: 'other', access: 1, starred_by: ['reader'], shadow: false }) }
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
    for (const url of ['http://127.0.0.1/a', 'http://[::1]/', 'http://192.168.1.1/', 'http://10.1.1.1/', 'http://localhost/', 'file:///tmp/a', 'https://user:secret@example.org/']) {
        await assert.rejects(assertPublicArticleURL(url))
    }
    await assert.doesNotReject(assertPublicArticleURL('https://8.8.8.8/article'))
})
