import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'
import { randomUUID } from 'node:crypto'
import { definitionFrameSchema, guestDefinitionResultSchema, guestSessionSchema } from '@repo/api'
import { createGuestOperations, guestDigest } from '../server/mobile/guest'
import { createGuestStore } from '../server/mobile/guest-store'
import { testPublicMobileHandler, testMobileHandler } from './helpers/mobile'
import { guestRedisFixture } from './helpers/guest-redis'
import { createVocabularyOperations } from '../server/mobile/vocabulary-create'

const definition = { lemma: 'bank', definition: '河岸', etymology: null, cognates: null }
const selection = { quote: 'bank', context: 'Along the bank.', offset: 10, language: 'en', accent: 'AmE' }
function request(path: string, token?: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') {
    return new Request('https://leximory.test/api/mobile/v1' + path, {
        method,
        headers: {
            'content-type': 'application/json',
            'x-vercel-forwarded-for': '203.0.113.5',
            ...(token ? { authorization: 'Bearer ' + token } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
}
async function frames(response: Response) {
    return (await response.text())
        .trim()
        .split('\n')
        .map((value) => definitionFrameSchema.parse(JSON.parse(value)))
}
function fixture(t: TestContext) {
    const backend = guestRedisFixture()
    t.mock.method(globalThis, 'fetch', backend.fetcher)
    let now = Date.parse('2026-11-01T01:00:00Z')
    let calls = 0
    let fail = false
    let release: () => void = () => {}
    let held: Promise<void> | null = null
    const store = createGuestStore(backend.redis)
    const handler = testPublicMobileHandler(
        createGuestOperations({
            store,
            now: () => now,
            definitions: {
                detectLanguage: async () => 'en',
                cached: async () => null,
                cache: async () => {},
                async *generate() {
                    calls++
                    if (held) await held
                    if (fail) throw new Error('Provider down')
                    yield '{{bank||bank||河岸}}'
                },
            },
        }),
    )
    async function session() {
        const response = await handler(request('/guest/session', undefined, {}))
        assert.equal(response.status, 200)
        return guestSessionSchema.parse(await response.json())
    }
    return {
        backend,
        handler,
        store,
        session,
        calls: () => calls,
        hold() {
            held = new Promise<void>((resolve) => {
                release = resolve
            })
        },
        release() {
            release()
            held = null
        },
        fail(value = true) {
            fail = value
        },
        advance(milliseconds: number) {
            now += milliseconds
        },
    }
}

test('guest enrollment returns a scoped random credential, no account and five lookups for thirty days', async (t) => {
    const f = fixture(t)
    const session = await f.session()
    assert.equal(session.token.length, 43)
    assert.equal(session.allowance.limit, 5)
    assert.equal(session.allowance.used, 0)
    assert.equal(session.expiresAt, '2026-12-01T01:00:00.000Z')
    assert.equal(session.allowance.resetsAt, session.expiresAt)
    assert.equal(f.calls(), 0)
    const protectedRoute = testMobileHandler(
        {
            me: async () => {
                throw new Error('Guest reached protected operation')
            },
        },
        async () => ({ kind: 'unauthenticated' }),
    )
    assert.equal((await protectedRoute(request('/me', session.token))).status, 401)
})

test('real guest routes generate once for concurrent retries, replay results and reject changed payloads', async (t) => {
    const f = fixture(t)
    const { token } = await f.session()
    const requestId = randomUUID()
    f.hold()
    const original = await f.handler(request('/guest/definitions', token, { ...selection, requestId }))
    const duplicate = await f.handler(request('/guest/definitions', token, { ...selection, requestId }))
    const running = await f.handler(request('/guest/definitions/' + requestId, token))
    assert.equal((await running.json()).state, 'running')
    assert.equal(f.calls(), 1)
    f.release()
    assert.deepEqual((await frames(original)).at(-1), { kind: 'completed', requestId, definition })
    assert.deepEqual((await frames(duplicate)).at(-1), { kind: 'completed', requestId, definition })
    const recovered = guestDefinitionResultSchema.parse(
        await (await f.handler(request('/guest/definitions/' + requestId, token))).json(),
    )
    assert.equal(recovered.state, 'completed')
    assert.equal(recovered.allowance.used, 1)
    const replay = await f.handler(request('/guest/definitions', token, { ...selection, requestId }))
    assert.equal((await frames(replay)).at(-1)?.kind, 'completed')
    assert.equal(f.calls(), 1)
    assert.equal(
        (await f.handler(request('/guest/definitions', token, { ...selection, requestId, accent: 'BrE' }))).status,
        400,
    )
})

test('guest quota is atomic, does not reset at midnight, and rejects a sixth new lookup before the model', async (t) => {
    const f = fixture(t)
    const { token } = await f.session()
    for (let index = 0; index < 5; index++) {
        const response = await f.handler(
            request('/guest/definitions', token, { ...selection, requestId: randomUUID() }),
        )
        assert.equal((await frames(response)).at(-1)?.kind, 'completed')
    }
    f.advance(86400000)
    assert.equal(
        (await f.handler(request('/guest/definitions', token, { ...selection, requestId: randomUUID() }))).status,
        429,
    )
    assert.equal(f.calls(), 5)
})

test('provider failure returns its credit once and repeated recovery cannot refund another request', async (t) => {
    const f = fixture(t)
    const { token } = await f.session()
    f.fail()
    const requestId = randomUUID()
    assert.equal(
        (await frames(await f.handler(request('/guest/definitions', token, { ...selection, requestId })))).at(-1)?.kind,
        'failed',
    )
    f.fail(false)
    const nextId = randomUUID()
    await frames(await f.handler(request('/guest/definitions', token, { ...selection, requestId: nextId })))
    for (let index = 0; index < 3; index++) {
        const result = guestDefinitionResultSchema.parse(
            await (await f.handler(request('/guest/definitions/' + requestId, token))).json(),
        )
        assert.equal(result.state, 'failed')
        assert.equal(result.allowance.used, 1)
    }
    assert.equal(f.calls(), 2)
})

test('invalid credentials and bad selections never run AI; enrollment is throttled by the trusted network bucket', async (t) => {
    const f = fixture(t)
    const { token } = await f.session()
    assert.equal(
        (await f.handler(request('/guest/definitions', 'forged', { ...selection, requestId: randomUUID() }))).status,
        401,
    )
    assert.equal(
        (await f.handler(request('/guest/definitions', token, { ...selection, offset: 0, requestId: randomUUID() })))
            .status,
        400,
    )
    assert.equal(
        (
            await f.handler(
                request('/guest/definitions', token, { ...selection, model: 'unrestricted', requestId: randomUUID() }),
            )
        ).status,
        400,
    )
    assert.equal(f.calls(), 0)
    for (let index = 0; index < 5; index++) await f.session()
    assert.equal((await f.handler(request('/guest/session', undefined, {}))).status, 429)
})

test('revocation removes recoverable contexts/results and prevents in-flight work from restoring them', async (t) => {
    const f = fixture(t)
    const { token } = await f.session()
    const requestId = randomUUID()
    f.hold()
    const response = await f.handler(request('/guest/definitions', token, { ...selection, requestId }))
    const session = await f.store.session(guestDigest(token))
    assert.ok(session)
    assert.equal((await f.handler(request('/guest/session/revoke', token, {}))).status, 200)
    f.release()
    assert.equal((await frames(response)).at(-1)?.kind, 'failed')
    assert.equal((await f.handler(request('/guest/definitions/' + requestId, token))).status, 401)
    assert.equal(await f.store.result(session.id, requestId), null)
    assert.equal(
        [...f.backend.values.keys()].some((key) => key.endsWith(':result')),
        false,
    )
})

test('guest allowance fails closed when metering is unavailable, while a committed lost response can be recovered', async (t) => {
    const f = fixture(t)
    const { token } = await f.session()
    f.backend.fail()
    assert.equal(
        (await f.handler(request('/guest/definitions', token, { ...selection, requestId: randomUUID() }))).status,
        503,
    )
    assert.equal(f.calls(), 0)
    f.backend.fail(false)
    const session = await f.store.session(guestDigest(token))
    assert.ok(session)
    const requestId = randomUUID()
    const claim = {
        sessionId: session.id,
        requestId,
        hash: 'payload',
        startedAt: Date.now(),
        window: { day: 'period', resetsAt: session.expiresAt, expiresIn: 60 },
    }
    await f.store.begin(claim)
    f.backend.loseNextResponse()
    await assert.rejects(f.store.finish(claim, { state: 'completed', language: 'en', definition }, true))
    assert.deepEqual(await f.store.result(session.id, requestId), { state: 'completed', language: 'en', definition })
})

test('saving a displayed guest definition is an authenticated single-word action, never a guest write', async () => {
    const writes: unknown[] = []
    const handler = testMobileHandler(
        createVocabularyOperations({
            save: async (subject, input) => {
                writes.push({ subject, input })
                return { id: 'word', libraryId: 'warehouse' }
            },
        }),
        async () => ({ kind: 'unauthenticated' }),
    )
    const body = { requestId: randomUUID(), language: 'en', fields: { original: 'bank', ...definition } }
    assert.equal((await handler(request('/vocabulary', 'guest', body))).status, 401)
    assert.equal(writes.length, 0)
})
