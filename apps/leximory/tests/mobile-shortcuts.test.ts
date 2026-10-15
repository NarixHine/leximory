import { setTimeout as delay } from 'node:timers/promises'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mobileSubjectSchema } from '@repo/schema/mobile'
import { createShortcutOperations, type ShortcutStore, type ShortcutWordResult } from '../server/mobile/shortcuts'
import type { CompletedDefinition, DefinitionServices } from '../server/mobile/definitions'
import { MobileError } from '../server/mobile/errors'
import { testMobileHandler } from './helpers/mobile'

const subject = mobileSubjectSchema.parse({ userId: 'reader' })
function harness(
    options: {
        quota?: boolean
        invalidLanguage?: boolean
        malformed?: boolean
        loseSave?: boolean
        delayGeneration?: number
        failGenerationOnce?: boolean
        deferSave?: boolean
        failSave?: boolean
    } = {},
) {
    const metrics = { detections: 0, charges: 0, generations: 0, saves: [] as string[], libraries: 0 }
    const receipts = new Map<string, { word: string; result?: ShortcutWordResult }>()
    const chargedRequests = new Set<string>()
    const leases = new Map<string, string>()
    const cache = new Map<string, CompletedDefinition>()
    const pending: (() => Promise<void>)[] = []
    async function flush() {
        for (const work of pending.splice(0)) await work()
    }
    const shortcuts: ShortcutStore = {
        async begin(owner, id, word, lease, signal) {
            const key = owner.userId + id
            const receipt = receipts.get(key)
            if (receipt && receipt.word !== word) throw new MobileError('invalid_input')
            if (!receipt) receipts.set(key, { word })
            if (receipt?.result) return receipt.result
            while (leases.has(key)) {
                await delay(1, undefined, { signal })
                const completed = receipts.get(key)?.result
                if (completed) return completed
            }
            leases.set(key, lease)
            return null
        },
        async complete(owner, id, word, result, lease) {
            assert.equal(leases.get(owner.userId + id), lease)
            receipts.set(owner.userId + id, { word, result })
        },
        release: async (owner, id, lease) => {
            if (leases.get(owner.userId + id) === lease) leases.delete(owner.userId + id)
        },
    }
    const definitions: DefinitionServices = {
        preferences: async () => ({ accent: '', limit: 10 }),
        cached: async (key) => cache.get(key) ?? null,
        cache: async (key, value) => {
            cache.set(key, value)
        },
        charge: async (_subject, _limit, requestId) => {
            assert.ok(requestId)
            if (chargedRequests.has(requestId)) return true
            metrics.charges++
            if (options.quota === false) return false
            chargedRequests.add(requestId)
            return true
        },
        async *generate() {
            metrics.generations++
            if (options.failGenerationOnce && metrics.generations === 1) throw new TypeError('provider disconnected')
            if (options.delayGeneration) await delay(options.delayGeneration)
            yield options.malformed
                ? '{{x||x||' + 'a'.repeat(17000) + '}}'
                : '{{bonjour||bonjour||**你好**\n\n礼貌的问候。||来自 *bon* 与 *jour*。||**jour**：一天。}}'
        },
        complete: async () => {},
        receipt: async () => null,
        async save(owner, library, language, definition, requestId) {
            assert.equal(owner.userId, 'reader')
            assert.equal(library, 'french-shadow')
            assert.equal(language, 'fr')
            assert.equal(definition.lemma, 'bonjour')
            metrics.saves.push(requestId ?? '')
            if (options.failSave) throw new TypeError('save unavailable')
            if (options.loseSave && metrics.saves.length === 1) throw new TypeError('response lost')
            return { id: 'word', libraryId: library }
        },
    }
    const operations = createShortcutOperations({
        definitions,
        shortcuts,
        after: (work) => {
            pending.push(work)
        },
        detectLanguage: async () => {
            metrics.detections++
            if (options.invalidLanguage) throw new MobileError('language_unresolved')
            return 'fr'
        },
        shadowLibrary: async () => {
            metrics.libraries++
            return 'french-shadow'
        },
    })
    const endpoint = testMobileHandler(operations, async () => ({ kind: 'authenticated', subject }))
    return {
        metrics,
        flush,
        leases,
        handler: async (request: Request) => {
            const response = await endpoint(request)
            if (!options.deferSave) await flush()
            return response
        },
    }
}
const request = (body: unknown, bearer = true) =>
    new Request('https://leximory.test/api/mobile/v1/shortcuts/words', {
        method: 'POST',
        headers: bearer ? { authorization: 'Bearer verified' } : {},
        body: JSON.stringify(body),
    })
test('Shortcut returns its complete Markdown annotation in one HTTP request', async () => {
    const h = harness()
    const response = await h.handler(request({ word: ' bonjour ', requestId: 'save' }))
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
        language: 'fr',
        annotation: {
            lemma: 'bonjour',
            definition: '**你好**\n\n礼貌的问候。',
            etymology: '来自 *bon* 与 *jour*。',
            cognates: '**jour**：一天。',
        },
    })
    assert.equal(h.metrics.detections, 1)
    assert.equal(h.metrics.charges, 1)
    assert.deepEqual(h.metrics.saves, ['save'])
})
test('a completed retry returns the original result without AI or saving again', async () => {
    const h = harness()
    const body = { word: 'bonjour', requestId: 'save' }
    const first = await (await h.handler(request(body))).json()
    const retry = await (await h.handler(request(body))).json()
    assert.deepEqual(retry, first)
    assert.equal(retry.annotation.definition, '**你好**\n\n礼貌的问候。')
    assert.equal(retry.annotation.etymology, '来自 *bon* 与 *jour*。')
    assert.equal(h.metrics.detections, 1)
    assert.equal(h.metrics.charges, 1)
    assert.deepEqual(h.metrics.saves, ['save'])
    assert.equal((await h.handler(request({ ...body, word: 'different' }))).status, 400)
})
test('an uncertain background save retries with the same mutation identity without delaying the annotation', async () => {
    const h = harness({ loseSave: true })
    const body = { word: 'bonjour', requestId: 'save' }
    const response = await h.handler(request(body))
    assert.equal(response.status, 200)
    assert.equal((await response.json()).annotation.cognates, '**jour**：一天。')
    assert.equal(h.metrics.charges, 1)
    assert.deepEqual(h.metrics.saves, ['save', 'save'])
})

test('the annotation returns before any library or save work and saving survives request cancellation', async () => {
    const h = harness({ deferSave: true })
    const controller = new AbortController()
    const response = await h.handler(
        new Request(request({ word: 'bonjour', requestId: 'save' }), { signal: controller.signal }),
    )
    assert.equal(response.status, 200)
    assert.equal((await response.json()).annotation.definition, '**你好**\n\n礼貌的问候。')
    assert.equal(h.metrics.libraries, 0)
    assert.deepEqual(h.metrics.saves, [])
    assert.equal(h.leases.size, 1)
    controller.abort()
    await h.flush()
    assert.deepEqual(h.metrics.saves, ['save'])
    assert.equal(h.leases.size, 0)
})

test('an exhausted background save releases its lease and does not record a completed save', async () => {
    const h = harness({ deferSave: true, failSave: true })
    const body = { word: 'bonjour', requestId: 'save' }
    assert.equal((await h.handler(request(body))).status, 200)
    await assert.rejects(h.flush(), /save unavailable/)
    assert.equal(h.leases.size, 0)
    assert.deepEqual(h.metrics.saves, ['save', 'save', 'save'])
    assert.equal((await h.handler(request(body))).status, 200)
    await assert.rejects(h.flush(), /save unavailable/)
    assert.equal(h.metrics.charges, 1)
    assert.equal(h.metrics.generations, 1)
})
test('invalid inputs and cookie-only authentication fail before language detection', async () => {
    const h = harness()
    for (const body of [
        { word: '', requestId: 'save' },
        { word: 'a'.repeat(1025), requestId: 'save' },
        { word: 'bonjour' },
        { word: 'bonjour', requestId: 'save', libraryId: 'forged' },
    ]) {
        assert.equal((await h.handler(request(body))).status, 400)
    }
    assert.equal((await h.handler(request({ word: 'bonjour', requestId: 'save' }, false))).status, 401)
    assert.equal(h.metrics.detections, 0)
    assert.deepEqual(h.metrics.saves, [])
})
for (const [options, status] of [
    [{ quota: false }, 429],
    [{ invalidLanguage: true }, 422],
    [{ malformed: true }, 503],
] as const) {
    test(`Shortcut failure ${JSON.stringify(options)} leaves the library untouched`, async () => {
        const h = harness(options)
        assert.equal((await h.handler(request({ word: 'bonjour', requestId: 'save' }))).status, status)
        assert.equal(h.metrics.libraries, 0)
        assert.deepEqual(h.metrics.saves, [])
    })
}

test('overlapping Shortcut retries perform one charged generation and save', async () => {
    const h = harness({ delayGeneration: 1500 })
    const body = { word: 'bonjour', requestId: 'same-request' }
    const responses = await Promise.all([h.handler(request(body)), h.handler(request(body))])
    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 200])
    assert.equal(h.metrics.charges, 1)
    assert.equal(h.metrics.generations, 1)
    assert.deepEqual(h.metrics.saves, ['same-request'])
    assert.equal((await h.handler(request(body))).status, 200)
    assert.equal(h.metrics.generations, 1)
})

test('a generation retry reuses the action quota debit even before a definition is cached', async () => {
    const h = harness({ failGenerationOnce: true })
    const body = { word: 'bonjour', requestId: 'same-request' }
    assert.equal((await h.handler(request(body))).status, 503)
    assert.equal((await h.handler(request(body))).status, 200)
    assert.equal(h.metrics.charges, 1)
    assert.equal(h.metrics.generations, 2)
    assert.deepEqual(h.metrics.saves, ['same-request'])
})
