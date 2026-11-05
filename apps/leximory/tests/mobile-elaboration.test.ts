import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mobileSubjectSchema } from '@repo/schema/mobile'
import { createElaborationOperations } from '../server/mobile/elaboration'
import { testMobileHandler } from './helpers/mobile'
import type { BrowserReceipt } from '../server/mobile/browser'
import type { CatalogStore } from '../server/mobile/catalog'

const subject = mobileSubjectSchema.parse({ userId: 'reader' })
const original = { lemma: 'bank', definition: '河岸', etymology: null, cognates: null }
const catalog: CatalogStore = {
    library: async () => null,
    text: async () => null,
    libraries: async () => [],
    texts: async () => [],
    archived: async () => [],
    audio: async () => null,
}
function harness(options: { owner?: string; quota?: boolean; fail?: boolean; sourceLibrary?: boolean } = {}) {
    const charges = new Set<string>()
    let generations = 0
    const receipt: BrowserReceipt = {
        subject: options.owner ?? 'reader',
        language: 'en',
        source: options.sourceLibrary ? { kind: 'library', libraryId: 'private' } : { kind: 'shadow' },
        context: 'They sat on the [[bank]] of the river.',
        libraryName: '',
        definition: original,
    }
    const operations = createElaborationOperations({
        definitions: {
            receipt: async () => null,
            preferences: async () => ({ accent: '', limit: 10 }),
            charge: async (_subject, limit, id) => {
                assert.equal(limit, 10)
                assert.ok(id)
                if (options.quota === false) return false
                charges.add(id)
                return true
            },
        },
        browser: { receipt: async () => receipt },
        catalog,
        async *generate(input) {
            generations++
            assert.equal(input.context, receipt.context)
            assert.deepEqual(input.definition, original)
            assert.equal(input.language, 'en')
            yield '**河岸**也可指'
            if (options.fail) throw new Error('provider disconnected')
            yield '河流转弯处的岸边。\n\n- *riverbank* 更明确。'
        },
    })
    return {
        charges,
        generations: () => generations,
        receipt,
        handler: testMobileHandler(operations, async () => ({ kind: 'authenticated', subject })),
    }
}
function request(bearer = true) {
    return new Request('https://leximory.test/api/mobile/v1/definitions/elaborate', {
        method: 'POST',
        headers: bearer ? { authorization: 'Bearer verified' } : {},
        body: JSON.stringify({ completionId: 'completion', source: 'browser', requestId: 'elaboration' }),
    })
}
test('elaboration streams context-specific Markdown without altering the saved definition; retries share quota identity', async () => {
    const h = harness()
    for (let attempt = 0; attempt < 2; attempt++) {
        const response = await h.handler(request())
        assert.equal(response.status, 200)
        const frames = (await response.text())
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line))
        assert.equal(frames[0].kind, 'started')
        assert.equal(frames[1].kind, 'delta')
        assert.equal(frames.at(-1).kind, 'completed')
        assert.equal(frames.at(-1).definition.definition, '**河岸**也可指河流转弯处的岸边。\n\n- *riverbank* 更明确。')
    }
    assert.deepEqual([...h.charges], ['elaborate-browser-completion-elaboration'])
    assert.deepEqual(h.receipt.definition, original)
})
test('elaboration enforces authentication, receipt ownership, current library access and quota before generation', async () => {
    for (const [options, bearer, status] of [
        [{}, false, 401],
        [{ owner: 'other' }, true, 404],
        [{ sourceLibrary: true }, true, 404],
        [{ quota: false }, true, 429],
    ] as const) {
        const h = harness(options)
        assert.equal((await h.handler(request(bearer))).status, status)
        assert.equal(h.generations(), 0)
    }
})
test('provider failure terminates the stream with a typed failure after visible partial text', async () => {
    const h = harness({ fail: true })
    const frames = (await (await h.handler(request())).text())
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
    assert.equal(frames[1].kind, 'delta')
    assert.equal(frames.at(-1).kind, 'failed')
    assert.equal(frames.at(-1).error.code, 'service_unavailable')
})
