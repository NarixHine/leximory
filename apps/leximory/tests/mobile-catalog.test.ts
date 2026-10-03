import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mobileSubjectSchema } from '@repo/schema/mobile'
import { createCatalog, PAGE_SIZE, type CatalogStore, type LibraryRow, type TextRow } from '../server/mobile/catalog'
import { createMobileHandler } from '../server/mobile/handler'
const subject = mobileSubjectSchema.parse({ userId: 'reader' })
const own: LibraryRow = { id: 'library', name: '文库', lang: 'en', owner: 'reader', access: 0, starred_by: null, shadow: false }
const article: TextRow = { id: 'text', lib: own.id, title: 'Title', content: 'Opening\n\n:::recording\nThe final passage\n:::', topics: null, emoji: null, has_ebook: false, created_at: null, no: null }
function store(overrides: Partial<CatalogStore> = {}): CatalogStore {
    return { library: async () => own, text: async () => article, libraries: async () => [own], texts: async () => [article], archived: async () => ['library'], audio: async () => 'https://example.com/signed.mp3', ...overrides }
}
const signal = new AbortController().signal
for (const [label, owner, access, starred, allowed] of [
    ['owner', 'reader', 0, null, true], ['starred public', 'other', 1, ['reader'], true],
    ['private starred', 'other', 0, ['reader'], false], ['unstarred public', 'other', 1, [], false],
] as const) {
    test(`document authorization: ${label}`, async () => {
        const catalog = createCatalog(store({ library: async () => ({ ...own, owner, access, starred_by: starred ? [...starred] : null }) }))
        if (allowed) assert.equal((await catalog.document(subject, 'text', signal)).document?.source, article.content)
        else await assert.rejects(catalog.document(subject, 'text', signal), { code: 'inaccessible' })
    })
}
test('ebook body is never returned as a complete document', async () => {
    const result = await createCatalog(store({ text: async () => ({ ...article, has_ebook: true }) })).document(subject, 'text', signal)
    assert.equal(result.text.format, 'ebook')
    assert.equal(result.document, null)
})
test('audio membership is checked before the signer is called', async () => {
    let signed = 0
    const catalog = createCatalog(store({ audio: async () => { signed++; return 'https://example.com/audio.mp3' } }))
    await assert.rejects(catalog.audio(subject, 'text', 'unrelated', signal), { code: 'inaccessible' })
    assert.equal(signed, 0)
    const descriptor = await catalog.audio(subject, 'text', 'recording', signal)
    assert.equal(signed, 1)
    assert.ok(Date.parse(descriptor.expiresAt) > Date.now() + 3590_000)
})
test('archived and shadow metadata survive catalog mapping', async () => {
    const result = await createCatalog(store({ libraries: async () => [{ ...own, shadow: true }] })).libraries(subject, undefined, signal)
    assert.equal(result.items[0]?.archived, true)
    assert.equal(result.items[0]?.shadow, true)
})
test('pagination reaches beyond 1000 rows with tied dates and null manual positions', async () => {
    const rows = Array.from({ length: 1107 }, (_, index): TextRow => ({ ...article, id: String(index).padStart(5, '0'), no: index < 600 ? null : 3, created_at: '2026-10-02T00:00:00Z' }))
    const catalog = createCatalog(store({ texts: async (libraryId, after) => {
        assert.equal(libraryId, own.id)
        const start = after ? rows.findIndex(row => row.id === after.id) + 1 : 0
        return rows.slice(start, start + PAGE_SIZE + 1)
    } }))
    let cursor: string | undefined
    const ids: string[] = []
    do {
        const result = await catalog.texts(subject, own.id, cursor, signal)
        ids.push(...result.items.map(item => item.id))
        cursor = result.nextCursor ?? undefined
    } while (cursor)
    assert.equal(ids.length, rows.length)
    assert.equal(new Set(ids).size, rows.length)
})
test('cursor cannot be replayed in another library', async () => {
    const catalog = createCatalog(store({ texts: async () => Array.from({ length: PAGE_SIZE + 1 }, (_, index) => ({ ...article, id: `text-${index}` })) }))
    const page = await catalog.texts(subject, own.id, undefined, signal)
    await assert.rejects(catalog.texts(subject, 'other', page.nextCursor ?? undefined, signal), { code: 'invalid_input' })
})
test('inaccessible library never queries its texts', async () => {
    let calls = 0
    const catalog = createCatalog(store({ library: async () => null, texts: async () => { calls++; return [] } }))
    await assert.rejects(catalog.texts(subject, 'missing', undefined, signal), { code: 'inaccessible' })
    assert.equal(calls, 0)
})
test('accidental store scope mismatch fails closed', async () => {
    await assert.rejects(createCatalog(store({ texts: async () => [{ ...article, lib: 'other' }] })).texts(subject, own.id, undefined, signal), { code: 'service_unavailable' })
})
test('HTTP adapter ignores cookies and returns private typed errors', async () => {
    const handler = createMobileHandler({ verify: async () => ({ kind: 'authenticated', subject }), store: store(), account: async () => ({ userId: subject.userId, plan: 'beginner', definitions: { used: 0, limit: 20, resetsIn: -2 } }) })
    const denied = await handler(new Request('https://example.com/api/mobile/v1/libraries', { headers: { cookie: 'session=anything' } }))
    assert.equal(denied.status, 401)
    assert.equal(denied.headers.get('cache-control'), 'private, no-store')
    const success = await handler(new Request('https://example.com/api/mobile/v1/texts/text', { headers: { authorization: 'Bearer verified' } }))
    assert.equal(success.status, 200)
    const payload = await success.json()
    assert.ok(payload.document.source.endsWith(':::'))
    assert.ok(payload.document.blocks.some((block: { displayText: string }) => block.displayText === 'The final passage'))
})


test('library archive action validates access and derives the account from its bearer token', async () => {
    const { createLibraryArchiveHandler } = await import('../server/mobile/library-preferences')
    const changes: unknown[] = []
    const handler = createLibraryArchiveHandler({ verify: async () => ({ kind: 'authenticated', subject }), catalog: store(),
        setArchived: async (...input) => { changes.push(input.slice(0, 3)) } })
    const request = (body: unknown) => new Request('https://example.com/api/mobile/v1/libraries/library/archive', {
        method: 'POST', headers: { authorization: 'Bearer token' }, body: JSON.stringify(body),
    })
    assert.equal((await handler(request({ archived: true, userId: 'other' }))).status, 400)
    assert.deepEqual(changes, [])
    assert.equal((await handler(request({ archived: true }))).status, 200)
    assert.equal((await handler(request({ archived: false }))).status, 200)
    assert.deepEqual(changes, [['reader', 'library', true], ['reader', 'library', false]])
    const denied = createLibraryArchiveHandler({ verify: async () => ({ kind: 'authenticated', subject }), catalog: store({ library: async () => null }),
        setArchived: async () => { throw Error('unauthorized write') } })
    assert.equal((await denied(request({ archived: true }))).status, 404)
})
