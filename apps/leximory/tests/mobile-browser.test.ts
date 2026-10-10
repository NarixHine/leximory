import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mobileSubjectSchema } from '@repo/schema/mobile'
import { createBrowserHandler, browserDomain, type BrowserReceipt, type BrowserStore } from '../server/mobile/browser'
import { createCatalog, type CatalogStore, type LibraryRow, type TextRow } from '../server/mobile/catalog'
import type { DefinitionServices } from '../server/mobile/definitions'

const subject = mobileSubjectSchema.parse({ userId: 'reader' })
const own: LibraryRow = { id: 'library', name: 'English News', lang: 'en', owner: 'reader', access: 0, starred_by: null, shadow: false }
const bookmark: TextRow = { id: 'bookmark', lib: own.id, title: 'BBC', content: '', has_ebook: false, bookmark_url: 'https://bbc.com/start', topics: [], emoji: null, created_at: null, no: null }
const selection = { url: 'https://example.com/linked-page', quote: 'bonjour', context: 'bonjour tout le monde', offset: 0, bookmarkId: null, libraryId: null }
function harness(options: { library?: LibraryRow; rule?: string; receiptOwner?: string; cached?: boolean; quota?: boolean; detectionError?: Error } = {}) {
    const library = options.library ?? own
    const receipts = new Map<string, BrowserReceipt>()
    const metrics = { detections: 0, charges: 0, saves: [] as string[], ruleWrites: 0, bookmarkWrites: 0 }
    const catalog: CatalogStore = {
        library: async id => id === library.id ? library : null,
        text: async () => bookmark, libraries: async () => [library], texts: async () => [bookmark], archived: async () => [], audio: async () => null,
    }
    const browser: BrowserStore = {
        detectLanguage: async () => { metrics.detections++; if (options.detectionError) throw options.detectionError; return 'fr' },
        rules: async () => options.rule ? [{ domain: 'example.com', libraryId: options.rule }] : [],
        setRule: async () => { metrics.ruleWrites++ },
        putReceipt: async (id, receipt) => { receipts.set(id, receipt) },
        receipt: async id => {
            const receipt = receipts.get(id)
            return receipt && options.receiptOwner ? { ...receipt, subject: options.receiptOwner } : receipt ?? null
        },
        shadowLibrary: async () => 'personal-shadow',
        bookmark: async () => { metrics.bookmarkWrites++; return { id: 'bookmark', libraryId: library.id, title: 'BBC', topics: [], emoji: null, createdAt: null, format: 'bookmark', bookmarkURL: bookmark.bookmark_url } },
    }
    const definition = { lemma: 'bonjour', definition: '你好', etymology: null, cognates: null }
    const definitions: DefinitionServices = {
        preferences: async () => ({ accent: '', limit: 10 }), cached: async () => options.cached ? definition : null,
        cache: async () => {}, charge: async () => { metrics.charges++; return options.quota !== false },
        async *generate() { yield '{{bonjour||bonjour||你好}}' },
        complete: async () => {}, receipt: async () => null,
        save: async (_, source, language) => {
            metrics.saves.push(source + ':' + language)
            return { id: 'word', libraryId: library.owner === subject.userId ? source : 'visitor-shadow' }
        },
    }
    return { handler: createBrowserHandler({ verify: async () => ({ kind: 'authenticated', subject }), catalog, browser, definitions }), metrics, catalog }
}
function request(path: string, body: unknown) {
    return new Request('https://leximory.test/api/mobile/v1/' + path, { method: 'POST', headers: { authorization: 'Bearer verified' }, body: JSON.stringify(body) })
}
test('iOS selections may omit unset Bookmark and library IDs', async () => {
    const { bookmarkId: _bookmark, libraryId: _library, ...webpage } = selection
    for (const choice of [{}, { bookmarkId: 'bookmark' }, { libraryId: own.id }]) {
        const h = harness()
        const response = await h.handler(request('browser/selection', { ...webpage, ...choice }))
        assert.equal(response.status, 200)
        const target = await response.json()
        assert.equal(target.language, Object.keys(choice).length ? 'en' : 'fr')
        assert.equal(h.metrics.detections, Object.keys(choice).length ? 0 : 1)
    }
})
test('iOS can clear a domain destination by omitting its library ID', async () => {
    const h = harness()
    const response = await h.handler(request('browser/rules', { domain: 'example.com' }))
    assert.equal(response.status, 200)
    assert.equal(h.metrics.ruleWrites, 1)
})
test('Bookmark language stays fixed after following links and never invokes Jev', async () => {
    const h = harness()
    const response = await h.handler(request('browser/selection', { ...selection, bookmarkId: 'bookmark', libraryId: 'ignored' }))
    assert.equal(response.status, 200)
    const target = await response.json()
    assert.equal(target.language, 'en')
    assert.equal(target.libraryId, own.id)
    assert.equal(h.metrics.detections, 0)
})
test('explicit domain and manual library choices override detected article language', async () => {
    for (const manual of [false, true]) {
        const h = harness({ rule: manual ? undefined : own.id })
        const target = await (await h.handler(request('browser/selection', { ...selection, libraryId: manual ? own.id : null }))).json()
        assert.equal(target.language, 'en')
        assert.equal(h.metrics.detections, 0)
    }
})
test('unmapped or deleted domain rules fall back to detected-language shadow library', async () => {
    for (const rule of [undefined, 'deleted']) {
        const h = harness({ rule })
        const target = await (await h.handler(request('browser/selection', selection))).json()
        assert.equal(target.language, 'fr')
        assert.equal(target.libraryId, null)
        assert.equal(target.shadow, true)
        assert.equal(h.metrics.detections, 1)
    }
})
test('shared Bookmark ignores personal domain rules and always saves to visitor shadow', async () => {
    const h = harness({ library: { ...own, owner: 'other', access: 1, starred_by: ['reader'] }, rule: own.id })
    const target = await (await h.handler(request('browser/selection', { ...selection, bookmarkId: 'bookmark' }))).json()
    assert.equal(target.shadow, true)
    assert.equal(target.language, 'en')
    const stream = await h.handler(request('browser/definitions', { selectionId: target.selectionId }))
    const frames = (await stream.text()).trim().split('\n').map(line => JSON.parse(line))
    const saved = await h.handler(request('browser/vocabulary', { completionId: frames.at(-1).requestId, requestId: 'save' }))
    assert.equal((await saved.json()).libraryId, 'visitor-shadow')
    assert.equal(h.metrics.detections, 0)
})
test('private shared Bookmark and forged manual destinations fail before AI or writes', async () => {
    const h = harness({ library: { ...own, owner: 'other' } })
    for (const input of [{ ...selection, bookmarkId: 'bookmark' }, { ...selection, libraryId: own.id }]) {
        assert.equal((await h.handler(request('browser/selection', input))).status, 404)
    }
    assert.equal(h.metrics.detections, 0)
})
test('browser receipts cannot be replayed by another account', async () => {
    const h = harness({ receiptOwner: 'another-reader' })
    const target = await (await h.handler(request('browser/selection', selection))).json()
    assert.equal((await h.handler(request('browser/definitions', { selectionId: target.selectionId }))).status, 400)
    assert.equal(h.metrics.charges, 0)
})
test('cached definitions do not charge, and save uses resolved shadow language', async () => {
    const h = harness({ cached: true })
    const target = await (await h.handler(request('browser/selection', selection))).json()
    const frames = (await (await h.handler(request('browser/definitions', { selectionId: target.selectionId }))).text()).trim().split('\n').map(line => JSON.parse(line))
    assert.deepEqual(frames.map(frame => frame.kind), ['started', 'completed'])
    assert.equal(h.metrics.charges, 0)
    await h.handler(request('browser/vocabulary', { completionId: frames.at(-1).requestId, requestId: 'save' }))
    assert.deepEqual(h.metrics.saves, ['personal-shadow:fr'])
})
test('quota and quote bounds are checked before definition generation', async () => {
    const h = harness({ quota: false })
    assert.equal((await h.handler(request('browser/selection', { ...selection, offset: 1 }))).status, 400)
    assert.equal(h.metrics.detections, 0)
    const target = await (await h.handler(request('browser/selection', selection))).json()
    assert.equal((await h.handler(request('browser/definitions', { selectionId: target.selectionId }))).status, 429)
})
test('rules and Bookmark creation require ownership', async () => {
    const h = harness({ library: { ...own, owner: 'other', access: 1, starred_by: ['reader'] } })
    assert.equal((await h.handler(request('browser/rules', { domain: 'example.com', libraryId: own.id }))).status, 404)
    assert.equal((await h.handler(request('libraries/library/bookmarks', { url: 'https://bbc.com', requestId: 'create' }))).status, 404)
    assert.equal(h.metrics.ruleWrites + h.metrics.bookmarkWrites, 0)
})
test('Bookmark catalog preserves URL and never exposes an article document', async () => {
    const h = harness()
    const result = await createCatalog(h.catalog).document(subject, 'bookmark', new AbortController().signal)
    assert.equal(result.text.format, 'bookmark')
    assert.equal(result.text.bookmarkURL, bookmark.bookmark_url)
    assert.equal(result.document, null)
})
test('domains normalize www and reject paths, credentials, and oversized labels', () => {
    assert.equal(browserDomain('WWW.Example.com'), 'example.com')
    assert.equal(browserDomain('[2001:db8::1]'), '[2001:db8::1]')
    for (const value of ['example.com/path', 'user:password@example.com', 'a'.repeat(64) + '.com']) assert.throws(() => browserDomain(value))
})

for (const Failure of [TypeError, SyntaxError]) test(`lookup ${Failure.name} remains a retryable service error with safe stage diagnostics`, async () => {
    const privateText = 'a private selection that must never appear in logs'
    const h = harness({ detectionError: new Failure(privateText) })
    const logs: unknown[][] = []
    const original = console.error
    console.error = (...args) => { logs.push(args) }
    try {
        const input = request('browser/selection', selection)
        input.headers.set('X-Leximory-Request-ID', 'diagnostic-test')
        const response = await h.handler(input)
        assert.equal(response.status, 503)
        assert.equal((await response.json()).error.code, 'service_unavailable')
        assert.equal(response.headers.get('X-Leximory-Request-ID'), 'diagnostic-test')
        assert.equal((logs[0]?.[1] as { stage: string }).stage, 'selection-language')
        assert.equal(JSON.stringify(logs).includes(privateText), false)
    } finally { console.error = original }
})
