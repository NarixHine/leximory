import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { mobileSubjectSchema } from '@repo/schema/mobile'
import { createDefinitionHandler, type DefinitionServices, type Receipt } from '../server/mobile/definitions'
import { renderDocument } from '../server/mobile/render-document'
import type { CatalogStore } from '../server/mobile/catalog'
const subject = mobileSubjectSchema.parse({ userId: 'reader' })
const document = renderDocument('A bank and another bank.\n\n{{embracing||embrace||欣然接受||来自法语||brace}}')
const selected = { textId: 'text', revision: document.revision, blockId: document.blocks[0]!.id, range: { location: 19, length: 4 } }
const definition = { lemma: 'bank', definition: '河岸 🙂', etymology: null, cognates: null }
const store: CatalogStore = {
    library: async () => ({ id: 'library', name: 'Library', lang: 'en', owner: 'reader', access: 0, starred_by: null, shadow: false }),
    text: async () => ({ id: 'text', lib: 'library', title: 'Title', content: document.source, no: null, created_at: null, topics: [], emoji: null, has_ebook: false }),
    libraries: async () => [], texts: async () => [], archived: async () => [], audio: async () => null,
}
function harness(overrides: Partial<DefinitionServices> = {}) {
    const receipts = new Map<string, Receipt>()
    const metrics = { charges: 0, generations: 0, saves: 0 }
    const services: DefinitionServices = {
        preferences: async () => ({ accent: 'British English', limit: 20 }), cached: async () => null, cache: async () => {},
        charge: async () => { metrics.charges++; return true },
        async *generate(context) { metrics.generations++; assert.ok(context.includes('another [[bank]]')); yield '{{bank||bank||河'; yield '岸 🙂}}' },
        complete: async (id, receipt) => { receipts.set(id, receipt) }, receipt: async id => receipts.get(id) ?? null,
        save: async (verified, library, lang, completed) => { metrics.saves++; assert.equal(verified.userId, 'reader'); assert.equal(library, 'library'); assert.equal(lang, 'en'); assert.ok(completed.lemma); return { id: 'word', libraryId: 'library' } },
        ...overrides,
    }
    return { handler: createDefinitionHandler({ verify: async () => ({ kind: 'authenticated', subject }), store, services, requestID: () => 'request-native-fixture' }), metrics, receipts }
}
function request(operation = 'definitions', input: unknown = selected) {
    let body = input
    if (operation === 'definitions' && input && typeof input === 'object' && 'textId' in input) {
        const { textId: _, ...rest } = input
        body = rest
    }
    return new Request(`https://example.com/api/mobile/v1/texts/text/${operation}`, { method: 'POST', headers: { authorization: 'Bearer verified', 'content-type': 'application/json' }, body: JSON.stringify(body) })
}
test('actual HTTP handler streams the second occurrence and stores completed provenance', async () => {
    const h = harness()
    const response = await h.handler(request())
    assert.equal(response.headers.get('content-type'), 'application/x-ndjson')
    const bytes = await response.text()
    const frames = bytes.trim().split('\n').map(line => JSON.parse(line))
    assert.deepEqual(frames.map(frame => frame.kind), ['started', 'delta', 'delta', 'completed'])
    assert.equal(frames.at(-1).definition.definition, '河岸 🙂')
    assert.equal(h.metrics.charges, 1)
    await writeFile(new URL('../../leximory-ios/Core/Tests/LeximoryCoreTests/Fixtures/definition-stream.ndjson', import.meta.url), bytes)
    const saved = await h.handler(request('vocabulary', { occurrence: selected, completionId: frames[0].requestId }))
    assert.equal(saved.status, 200)
    assert.equal(h.metrics.saves, 1)
})
test('cache hit uses the same terminal contract without charging or generation', async () => {
    const h = harness({ cached: async () => definition })
    const frames = (await (await h.handler(request())).text()).trim().split('\n').map(line => JSON.parse(line))
    assert.deepEqual(frames.map(frame => frame.kind), ['started', 'completed'])
    assert.equal(h.metrics.charges, 0); assert.equal(h.metrics.generations, 0)
})
test('quota denial happens before streaming headers or generation', async () => {
    const h = harness({ charge: async () => false })
    const response = await h.handler(request())
    assert.equal(response.status, 429); assert.equal(h.metrics.generations, 0)
})
test('malformed provider output ends in failed and cannot create a save receipt', async () => {
    const h = harness({ async *generate() { yield 'malformed' } })
    const frames = (await (await h.handler(request())).text()).trim().split('\n').map(line => JSON.parse(line))
    assert.equal(frames.at(-1).kind, 'failed'); assert.equal(h.receipts.size, 0)
})
test('save requires provenance or an actual embedded definition', async () => {
    const h = harness()
    const forged = await h.handler(request('vocabulary', { occurrence: selected, completionId: 'forged' }))
    assert.equal(forged.status, 400)
    const incomplete = await h.handler(request('vocabulary', { occurrence: selected, completionId: null }))
    assert.equal(incomplete.status, 400)
    const block = document.blocks[1]!
    const span = block.spans[0]!
    const saved = await h.handler(request('vocabulary', { occurrence: { ...selected, blockId: block.id, range: span.range }, completionId: null }))
    assert.equal(saved.status, 200); assert.equal(h.metrics.saves, 1)
})
test('forged destination, stale revision and invalid range never charge or save', async () => {
    const h = harness()
    const invalid = await h.handler(request('definitions', { ...selected, range: { location: 99, length: 4 } }))
    assert.equal(invalid.status, 400)
    const stale = await h.handler(request('definitions', { ...selected, revision: '0'.repeat(64) }))
    assert.equal(stale.status, 409)
    const forged = await h.handler(request('vocabulary', { occurrence: selected, completionId: null, libraryId: 'other' }))
    assert.equal(forged.status, 400); assert.equal(h.metrics.charges, 0); assert.equal(h.metrics.saves, 0)
})
test('cache keys separate accent, language and context', async () => {
    const keys: string[] = []
    for (const accent of ['British English', 'American English']) {
        const h = harness({ preferences: async () => ({ accent, limit: 20 }), cached: async key => { keys.push(key); return definition } })
        await (await h.handler(request())).text()
    }
    assert.notEqual(keys[0], keys[1])
})

test('save forwards a validated retry identity after checking provenance', async () => {
    let identity: string | undefined
    const h = harness({ save: async (_, __, ___, ____, requestId) => {
        identity = requestId
        return { id: 'word', libraryId: 'library' }
    } })
    const block = document.blocks[1]!
    const body = { occurrence: { ...selected, blockId: block.id, range: block.spans[0]!.range }, completionId: null, requestId: 'retry-identity' }
    assert.equal((await h.handler(request('vocabulary', body))).status, 200)
    assert.equal(identity, 'retry-identity')
    assert.equal((await h.handler(request('vocabulary', { ...body, requestId: 'invalid/key' }))).status, 400)
})
