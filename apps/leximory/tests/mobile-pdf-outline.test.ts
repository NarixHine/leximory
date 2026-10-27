import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFHexString, StandardFonts } from 'pdf-lib'
import { embedPDFOutline } from '../server/mobile/pdf-outline-document'
import { spawnSync } from 'node:child_process'
import { mobileSubjectSchema } from '@repo/schema/mobile'
import {
    createPDFOutlineOperations,
    pdfOutlineModelSchema,
    validatePDFOutline,
    type PDFOutlineStore,
} from '../server/mobile/pdf-outline'
import { publishPDFOutlineScript } from '../server/mobile/pdf-outline-publication'
import type { CatalogStore } from '../server/mobile/catalog'
import type { EbookStore } from '../server/mobile/ebooks'
import { MobileError } from '../server/mobile/errors'
import { testMobileHandler } from './helpers/mobile'

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
const ebooks: EbookStore = {
    asset: async () => ({ url: 'https://example.com/book.pdf', format: 'pdf', sourceVersion: 'source-v1' }),
    location: async () => null,
    bookmarks: async () => [],
    savePosition: async () => {},
    removeBookmark: async () => {},
    saveBookmark: async () => {
        throw Error('Unexpected bookmark write')
    },
}
const requestId = '12345678-1234-4234-8234-123456789abc'
const generation = { requestId, sourceVersion: 'source-v1', pages: ['Chapter one', 'Chapter two'] }
const save = {
    requestId,
    sourceVersion: 'source-v1',
    baseRevision: null,
    generationId: requestId,
    pdfDigest: 'a'.repeat(64),
}
const request = (path: string, body: unknown) =>
    new Request('https://example.com/api/mobile/v1/texts/book/' + path, {
        method: 'POST',
        headers: { authorization: 'Bearer verified', 'content-type': 'application/json' },
        body: JSON.stringify(body),
    })
function handler(outlines: PDFOutlineStore, source = catalog) {
    return testMobileHandler(createPDFOutlineOperations({ catalog: source, ebooks, outlines }), async () => ({
        kind: 'authenticated',
        subject,
    }))
}
function unexpected(): never {
    throw Error('Unexpected provider access')
}
const untouched: PDFOutlineStore = { generate: async () => unexpected(), save: async () => unexpected() }

test('PDF outline routes require modification authority, including shared and shadow folders', async () => {
    for (const library of [
        null,
        { id: 'library', name: 'Shared', lang: 'en', owner: 'someone', access: 1, starred_by: null, shadow: false },
        { id: 'library', name: 'Shadow', lang: 'en', owner: 'reader', access: 0, starred_by: null, shadow: true },
    ] satisfies Awaited<ReturnType<CatalogStore['library']>>[]) {
        const run = handler(untouched, { ...catalog, library: async () => library })
        for (const [path, body] of [
            ['pdf-outline-generate', generation],
            ['pdf-outline', save],
        ] satisfies [string, unknown][]) {
            assert.equal((await run(request(path, body))).status, 404)
        }
    }
})
test('stale source versions never generate or publish', async () => {
    const run = handler(untouched)
    assert.equal((await run(request('pdf-outline-generate', { ...generation, sourceVersion: 'old' }))).status, 409)
    assert.equal((await run(request('pdf-outline', { ...save, sourceVersion: 'old' }))).status, 409)
})
test('blank PDFs and empty or unusable model output are failures', async () => {
    const run = handler({ ...untouched, generate: async () => ({ entries: [] }) })
    assert.equal((await run(request('pdf-outline-generate', { ...generation, pages: [' ', ''] }))).status, 422)
    assert.equal((await run(request('pdf-outline-generate', generation))).status, 503)
    for (const entries of [
        [],
        [{ title: ' ', page: 1, depth: 0 }],
        [{ title: 'Invalid page', page: 3, depth: 0 }],
        [{ title: 'Orphan child', page: 1, depth: 1 }],
        [
            { title: 'Two', page: 2, depth: 0 },
            { title: 'One', page: 1, depth: 0 },
        ],
    ]) {
        assert.throws(() => validatePDFOutline({ entries }, 2))
    }
})
test('provider output still enforces the API entry limits before generation can succeed', async () => {
    for (const entries of [[], Array.from({ length: 1001 }, () => ({ title: 'Chapter', page: 1, depth: 0 }))]) {
        const output = pdfOutlineModelSchema.parse({ entries })
        const run = handler({ ...untouched, generate: async () => output })
        assert.equal((await run(request('pdf-outline-generate', generation))).status, 503)
    }
})
test('generation and publication keep their identities and server-derived scope', async () => {
    const calls: string[] = []
    const run = handler({
        generate: async (scope, input) => {
            assert.deepEqual(scope, { userId: 'reader', textId: 'book', sourceVersion: 'source-v1' })
            assert.equal(input.requestId, requestId)
            calls.push('generate')
            return { entries: [{ title: 'River', page: 1, depth: 0 }] }
        },
        save: async (_scope, input) => {
            assert.deepEqual(input, save)
            calls.push('save')
            return { revision: requestId, url: 'https://storage.example/published.pdf' }
        },
    })
    assert.equal((await run(request('pdf-outline-generate', generation))).status, 200)
    assert.deepEqual(calls, ['generate'])
    assert.equal((await run(request('pdf-outline', save))).status, 200)
    assert.deepEqual(calls, ['generate', 'save'])
})
test('quota exhaustion and storage failures remain typed failures at their affected operation', async () => {
    const exhausted = handler({
        ...untouched,
        generate: async () => {
            throw new MobileError('quota_exceeded')
        },
    })
    assert.equal((await exhausted(request('pdf-outline-generate', generation))).status, 429)
    const failed = handler({
        ...untouched,
        save: async () => {
            throw Error('storage failed')
        },
    })
    assert.equal((await failed(request('pdf-outline', save))).status, 503)
})

const lua = spawnSync('lua', ['-v'])
test(
    'publication Lua atomically charges once, rejects exhaustion and stale writers, and restores for free',
    { skip: lua.error ? 'Lua runtime unavailable' : false },
    () => {
        // Run the production transaction in Lua. Only the external Redis commands are in memory.
        const harness = `
local data, ttl = {}, {}
cjson = { decode = function(json) return { revision = assert(json:match('"revision":"([^"]+)"')) } end }
redis = { call = function(command, key, value)
  if command == 'GET' then return data[key]
  elseif command == 'SET' then data[key] = value; return 'OK'
  elseif command == 'INCRBYFLOAT' then data[key] = tostring(tonumber(data[key] or '0') + tonumber(value)); return data[key]
  elseif command == 'TTL' then return ttl[key] or -1
  elseif command == 'EXPIRE' then ttl[key] = tonumber(value); return 1
  else error(command) end
end }
local publish = assert(load([==[${publishPDFOutlineScript}]==]))
KEYS = { 'pointer', 'quota', 'receipt-one', 'history' }
ARGV = { '', '{"path":"one.pdf","revision":"one"}', '1', '2', 'saved-one', 'history-one' }
assert(publish() == 1)
assert(data.quota == '1' and ttl.quota == 2592000 and data.history == 'history-one')
assert(publish() == 2 and data.quota == '1')
-- A competing successful operation consumes the last shared unit.
data.quota = '2'
KEYS[3] = 'receipt-two'; ARGV[1] = 'one'; ARGV[2] = '{"path":"two.pdf","revision":"two"}'
assert(publish() == 0 and data.quota == '2' and not data['receipt-two'])
assert(data.pointer:find('one.pdf', 1, true))
-- Undo and redo can publish while exhausted and retain the reset deadline.
ARGV[3] = '0'; ARGV[6] = ''
assert(publish() == 1 and data.quota == '2' and ttl.quota == 2592000 and data.history == 'history-one')
KEYS[3] = 'stale'; ARGV[1] = 'one'; ARGV[3] = '1'
assert(publish() == -1 and not data.stale and data.quota == '2')
-- A lost-response retry succeeds despite exhausted quota and a newer revision.
KEYS[3] = 'receipt-one'
assert(publish() == 2 and data.quota == '2')
print('publication verified')
`
        const result = spawnSync('lua', ['-'], { input: harness, encoding: 'utf8' })
        assert.equal(result.status, 0, result.stderr)
        assert.match(result.stdout, /publication verified/)
    },
)

test('PDF serialization replaces nested outlines while preserving page content, links, annotations, and metadata', async () => {
    const original = await PDFDocument.create()
    original.setTitle('Keep metadata')
    const font = await original.embedFont(StandardFonts.Helvetica)
    const page = original.addPage([400, 600])
    original.addPage([400, 600])
    page.drawText('Keep original text', { font })
    const annotation = original.context.register(
        original.context.obj({
            Type: 'Annot',
            Subtype: 'Text',
            Rect: [30, 100, 110, 130],
            Contents: PDFHexString.fromText('Keep annotation'),
        }),
    )
    const link = original.context.register(
        original.context.obj({
            Type: 'Annot',
            Subtype: 'Link',
            Rect: [10, 10, 80, 30],
            A: { S: 'URI', URI: PDFHexString.fromText('https://example.com') },
        }),
    )
    page.node.set(PDFName.of('Annots'), original.context.obj([annotation, link]))
    original.catalog.set(
        PDFName.of('Outlines'),
        original.context.register(original.context.obj({ Type: 'Outlines', Count: 0 })),
    )
    const bytes = await original.save()
    const before = await PDFDocument.load(bytes, { updateMetadata: false })
    const output = await embedPDFOutline(bytes, [
        { title: '第一章', page: 1, depth: 0 },
        { title: 'Section', page: 2, depth: 1 },
        { title: 'Last', page: 2, depth: 0 },
    ])
    const reopened = await PDFDocument.load(output, { updateMetadata: false })
    assert.equal(reopened.getTitle(), 'Keep metadata')
    assert.equal(reopened.getPageCount(), 2)
    for (const [index, expected] of before.getPages().entries()) {
        const actual = reopened.getPage(index)
        assert.equal(
            actual.node.lookup(PDFName.of('Contents'))?.toString(),
            expected.node.lookup(PDFName.of('Contents'))?.toString(),
        )
        assert.equal(
            actual.node.lookup(PDFName.of('Resources'))?.toString(),
            expected.node.lookup(PDFName.of('Resources'))?.toString(),
        )
    }
    const annots = reopened.getPage(0).node.lookup(PDFName.of('Annots'), PDFArray)
    assert.equal(annots.size(), 2)
    assert.equal(annots.lookup(0, PDFDict).lookup(PDFName.of('Contents'), PDFHexString).decodeText(), 'Keep annotation')
    const root = reopened.catalog.lookup(PDFName.of('Outlines'), PDFDict)
    const first = root.lookup(PDFName.of('First'), PDFDict)
    assert.equal(first.lookup(PDFName.of('Title'), PDFHexString).decodeText(), '第一章')
    assert.equal(
        first.lookup(PDFName.of('First'), PDFDict).lookup(PDFName.of('Title'), PDFHexString).decodeText(),
        'Section',
    )
    assert.equal(
        first.lookup(PDFName.of('Next'), PDFDict).lookup(PDFName.of('Title'), PDFHexString).decodeText(),
        'Last',
    )
    const destination = first.lookup(PDFName.of('Dest'), PDFArray)
    assert.equal(destination.get(0).toString(), reopened.getPage(0).ref.toString())
})
