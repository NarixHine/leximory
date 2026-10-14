import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createReviewHandler } from '../server/mobile/review'
import type { BearerVerifier } from '../server/mobile/auth'
import { mobileSubjectSchema } from '@repo/schema/mobile'

const subject = mobileSubjectSchema.parse({ userId: '00000000-0000-4000-8000-000000000001' })
const verify: BearerVerifier = async () => ({ kind: 'authenticated', subject })
const unused = async () => { throw new Error('Unexpected review operation') }
const dependencies = { verify, timeline: unused, check: unused, start: unused, translation: unused, conversation: unused }
const request = (path: string, body?: unknown) => new Request(`https://leximory.test/api/mobile/v1/review${path}`, {
    method: body === undefined ? 'GET' : 'POST', headers: { authorization: 'Bearer valid', 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})

test('review rejects unauthenticated readers before accessing review data', async () => {
    const handler = createReviewHandler({ ...dependencies, verify: async () => ({ kind: 'unauthenticated' }) })
    const response = await handler(request(''))
    assert.equal(response.status, 401)
    assert.equal((await response.json()).error.code, 'unauthenticated')
})

test('native submissions use the verified owner rather than a payload user ID', async () => {
    const handler = createReviewHandler({ ...dependencies, translation: async (input, userId) => {
        assert.equal(userId, subject.userId)
        assert.equal((await input.json()).index, 2)
        return Response.json({ success: true })
    } })
    const response = await handler(request('/translation', { date: '2026-10-12', lang: 'en', index: 2, submission: 'A quiet place', userId: 'forged-owner' }))
    assert.equal(response.status, 200)
})

test('review selections reject unsupported languages and malformed dates', async () => {
    const handler = createReviewHandler(dependencies)
    for (const path of ['/check?date=yesterday&lang=en', '/check?date=2026-10-12&lang=invalid']) {
        const response = await handler(request(path))
        assert.equal(response.status, 400)
        assert.equal((await response.json()).error.code, 'invalid_input')
    }
})

test('native stories preserve embedded vocabulary in the existing reader contract', async () => {
    const handler = createReviewHandler({ ...dependencies, check: async (_, owner) => {
        assert.equal(owner, subject.userId)
        return Response.json({ exists: true, inProgress: false, stage: 'complete', story: 'A {{quiet||quiet||安静的}} place.', translations: [], conversation: null })
    } })
    const response = await handler(request('/check?date=2026-10-12&lang=en'))
    const data = await response.json()
    assert.equal(data.storyDocument.blocks[0].displayText, 'A quiet place.')
    assert.equal(data.storyDocument.blocks[0].spans[0].kind, 'definition')
    assert.equal(data.storyDocument.blocks[0].spans[0].definition, '安静的')
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
})

test('native timeline separates display words from definition markup', async () => {
    const handler = createReviewHandler({ ...dependencies,
        timeline: async () => ({ nextCursor: undefined, days: [{ date: '2026-10-12', displayDate: '10月12日', dayOfWeek: '周一', count: 1, isToday: false, progressByLang: {}, words: [{ id: 'word', lib: 'folder', lang: 'en', word: '{{bank||bank||河岸||Old Norse||embankment}}' }] }] }),
    })
    const response = await handler(request(''))
    const data = await response.json()
    assert.equal(data.days[0].words[0].word, 'bank')
    assert.deepEqual(data.days[0].words[0].fields, { original: 'bank', lemma: 'bank', definition: '河岸', etymology: 'Old Norse', cognates: 'embankment' })
})
