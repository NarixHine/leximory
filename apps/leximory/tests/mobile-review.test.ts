import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createReviewOperations } from '../server/mobile/review'
import { testMobileHandler } from './helpers/mobile'
import type { BearerVerifier } from '../server/mobile/auth'
import { mobileSubjectSchema } from '@repo/schema/mobile'

const subject = mobileSubjectSchema.parse({ userId: '00000000-0000-4000-8000-000000000001' })
const verify: BearerVerifier = async () => ({ kind: 'authenticated', subject })
const unused = async () => {
    throw new Error('Unexpected review operation')
}
const dependencies = { timeline: unused, check: unused, start: unused, translation: unused, conversation: unused }
const request = (path: string, body?: unknown) =>
    new Request(`https://leximory.test/api/mobile/v1/review${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { authorization: 'Bearer valid', 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })

test('review rejects unauthenticated readers before accessing review data', async () => {
    const handler = testMobileHandler(createReviewOperations(dependencies), async () => ({ kind: 'unauthenticated' }))
    const response = await handler(request(''))
    assert.equal(response.status, 401)
    assert.equal((await response.json()).error.code, 'unauthenticated')
})

test('native submissions use the verified owner', async () => {
    const handler = testMobileHandler(
        createReviewOperations({
            ...dependencies,
            translation: async (input, userId) => {
                assert.equal(userId, subject.userId)
                assert.equal((await input.json()).index, 2)
                return Response.json({ success: true })
            },
        }),
        verify,
    )
    const response = await handler(
        request('/translation', {
            date: '2026-10-12',
            lang: 'en',
            index: 2,
            submission: 'A quiet place',
        }),
    )
    assert.equal(response.status, 200)
})

test('review selections reject unsupported languages and malformed dates', async () => {
    const handler = testMobileHandler(createReviewOperations(dependencies), verify)
    for (const path of ['/check?date=yesterday&lang=en', '/check?date=2026-10-12&lang=invalid']) {
        const response = await handler(request(path))
        assert.equal(response.status, 400)
        assert.equal((await response.json()).error.code, 'invalid_input')
    }
})

test('native stories preserve embedded vocabulary in the existing reader contract', async () => {
    const handler = testMobileHandler(
        createReviewOperations({
            ...dependencies,
            check: async (_, owner) => {
                assert.equal(owner, subject.userId)
                return Response.json({
                    exists: true,
                    inProgress: false,
                    stage: 'complete',
                    story: 'A {{quiet||quiet||安静的}} place.',
                    translations: [],
                    conversation: null,
                })
            },
        }),
        verify,
    )
    const response = await handler(request('/check?date=2026-10-12&lang=en'))
    const data = await response.json()
    assert.equal(data.storyDocument.blocks[0].displayText, 'A quiet place.')
    assert.equal(data.storyDocument.blocks[0].spans[0].kind, 'definition')
    assert.equal(data.storyDocument.blocks[0].spans[0].definition, '安静的')
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
})

test('native timeline separates display words from definition markup', async () => {
    const handler = testMobileHandler(
        createReviewOperations({
            ...dependencies,
            timeline: async () => ({
                nextCursor: undefined,
                days: [
                    {
                        date: '2026-10-12',
                        displayDate: '10月12日',
                        dayOfWeek: '周一',
                        count: 1,
                        isToday: false,
                        progressByLang: {},
                        words: [
                            {
                                id: 'word',
                                lib: 'folder',
                                lang: 'en',
                                word: '{{bank||bank||河岸||Old Norse||embankment}}',
                            },
                        ],
                    },
                ],
            }),
        }),
        verify,
    )
    const response = await handler(request(''))
    const data = await response.json()
    assert.equal(data.nextCursor, null)
    assert.equal(data.days[0].count, 1)
    assert.equal(data.days[0].words[0].word, 'bank')
    assert.deepEqual(data.days[0].words[0].fields, {
        original: 'bank',
        lemma: 'bank',
        definition: '河岸',
        etymology: 'Old Norse',
        cognates: 'embankment',
    })
})

test('review query parsing rejects unknown and duplicate parameters', async () => {
    const handler = testMobileHandler(createReviewOperations(dependencies), verify)
    for (const path of [
        '?extra=1',
        '?cursor=one&cursor=two',
        '/check?date=2026-10-12&lang=en&lang=fr',
        '/check?date=2026-10-12&lang=en&cursor=x',
    ]) {
        const response = await handler(request(path))
        assert.equal(response.status, 400)
        assert.equal((await response.json()).error.code, 'invalid_input')
    }
})

test('review selections reject impossible calendar dates', async () => {
    const handler = testMobileHandler(createReviewOperations(dependencies), verify)
    const response = await handler(request('/check?date=2026-02-30&lang=en'))
    assert.equal(response.status, 400)
})

test('review forwarding bounds the actual UTF-8 body without a content-length header', async () => {
    const handler = testMobileHandler(createReviewOperations(dependencies), verify)
    const input = request('/conversation', { date: '2026-10-12', lang: 'en', submission: '中'.repeat(3000) })
    assert.equal(input.headers.has('content-length'), false)
    const response = await handler(input)
    assert.equal(response.status, 400)
    assert.equal((await response.json()).error.code, 'invalid_input')
})

test('review forwarding rejects malformed JSON before starting work', async () => {
    const handler = testMobileHandler(createReviewOperations(dependencies), verify)
    const input = new Request('https://leximory.test/api/mobile/v1/review/start', {
        method: 'POST',
        headers: { authorization: 'Bearer valid' },
        body: '{invalid',
    })
    const response = await handler(input)
    assert.equal(response.status, 400)
    assert.equal((await response.json()).error.code, 'invalid_input')
})

test('review forwarding preserves headers and cancellation after consuming JSON', async () => {
    const controller = new AbortController()
    const handler = testMobileHandler(
        createReviewOperations({
            ...dependencies,
            start: async (input, owner) => {
                assert.equal(owner, subject.userId)
                assert.equal(input.headers.get('authorization'), 'Bearer valid')
                assert.equal(input.headers.get('x-client'), 'native-ios')
                assert.deepEqual(await input.json(), { date: '2026-10-12', lang: 'en' })
                controller.abort()
                assert.equal(input.signal.aborted, true)
                return Response.json({ success: true })
            },
        }),
        verify,
    )
    const response = await handler(
        new Request('https://leximory.test/api/mobile/v1/review/start', {
            method: 'POST',
            headers: { authorization: 'Bearer valid', 'x-client': 'native-ios' },
            body: JSON.stringify({ date: '2026-10-12', lang: 'en' }),
            signal: controller.signal,
        }),
    )
    assert.equal(response.status, 503)
})

test('invalid review provider data is a retryable server failure', async () => {
    const handler = testMobileHandler(
        createReviewOperations({ ...dependencies, check: async () => Response.json({ story: 123 }) }),
        verify,
    )
    const response = await handler(request('/check?date=2026-10-12&lang=en'))
    assert.equal(response.status, 503)
    assert.equal((await response.json()).error.code, 'service_unavailable')
})

test('review backend failures retain their status and receive private response headers', async () => {
    const handler = testMobileHandler(
        createReviewOperations({
            ...dependencies,
            check: async () => Response.json({ error: 'Review unavailable' }, { status: 404 }),
        }),
        verify,
    )
    const response = await handler(request('/check?date=2026-10-12&lang=en'))
    assert.equal(response.status, 404)
    assert.equal((await response.json()).error.code, 'inaccessible')
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.ok(response.headers.get('x-leximory-request-id'))
})

test('malformed timeline provider data is a server failure', async () => {
    const handler = testMobileHandler(
        createReviewOperations({
            ...dependencies,
            timeline: async () => ({
                nextCursor: undefined,
                days: [
                    {
                        date: '2026-10-12',
                        displayDate: '10月12日',
                        dayOfWeek: '周一',
                        count: -1,
                        isToday: false,
                        progressByLang: {},
                        words: [],
                    },
                ],
            }),
        }),
        verify,
    )
    const response = await handler(request(''))
    assert.equal(response.status, 503)
    assert.equal((await response.json()).error.code, 'service_unavailable')
})

test('native submissions reject ownership fields and oversized text before the backend', async () => {
    const handler = testMobileHandler(createReviewOperations(dependencies), verify)
    for (const payload of [
        { date: '2026-10-12', lang: 'en', index: 0, submission: 'hello', userId: 'forged-owner' },
        { date: '2026-10-12', lang: 'en', index: 0, submission: 'a'.repeat(501) },
    ])
        assert.equal((await handler(request('/translation', payload))).status, 400)
})
