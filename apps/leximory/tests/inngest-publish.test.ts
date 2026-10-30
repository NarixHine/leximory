import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createInngestClient } from '../server/inngest/runtime'
import { createArticlePublisher } from '../server/inngest/publish'
import { ExternalServiceError } from '../server/errors/external-service'

const settings = {
    INNGEST_EVENT_KEY: 'fixture-event-key',
    INNGEST_SIGNING_KEY: 'signkey-test-' + 'a'.repeat(64),
    INNGEST_ENV: 'fixture-preview',
    INNGEST_DEV: '0',
    INNGEST_BASE_URL: 'https://queue.fixture.invalid/',
    VERCEL_ENV: undefined,
} satisfies Parameters<typeof createInngestClient>[0]
const event = {
    id: 'one-import',
    data: {
        article: 'Along the river bank.',
        userId: 'reader',
        textId: 'article',
        onlyComments: false,
        generateTitle: true,
    },
}

test('the production publisher sends a validated event through the installed SDK with the configured environment', async () => {
    const requests: unknown[] = []
    const client = createInngestClient(settings, async (input, init) => {
        assert.equal(new URL(String(input)).pathname, '/e/fixture-event-key')
        assert.equal(new Headers(init?.headers).get('x-inngest-env'), 'fixture-preview')
        assert.equal(init?.method, 'POST')
        assert.ok(init?.signal instanceof AbortSignal, 'provider requests must have a bounded cancellation signal')
        const body = JSON.parse(String(init?.body))
        requests.push(body)
        assert.equal(body.length, 1)
        assert.deepEqual(body[0].data, event.data)
        assert.equal(body[0].id, event.id)
        assert.equal(body[0].name, 'app/article.imported')
        return Response.json({ status: 200, ids: ['accepted-event'] })
    })
    assert.deepEqual(await createArticlePublisher(client)(event), { eventId: 'accepted-event' })
    assert.equal(requests.length, 1)
})

for (const [status, message, code, retryable] of [
    [401, 'Event key not found', 'QUEUE_AUTHENTICATION_REJECTED', false],
    [400, 'Unknown branch environment', 'QUEUE_ENVIRONMENT_REJECTED', false],
    [413, 'Event payload too large', 'QUEUE_PAYLOAD_REJECTED', false],
    [503, 'Service unavailable', 'QUEUE_UNAVAILABLE', true],
] satisfies [number, string, string, boolean][]) {
    test(`the installed SDK's HTTP ${status} rejection retains an actionable safe failure`, async () => {
        const client = createInngestClient(settings, async () => Response.json({ status, error: message }, { status }))
        await assert.rejects(createArticlePublisher(client)(event), (error) => {
            assert.ok(error instanceof ExternalServiceError)
            assert.equal(error.code, code)
            assert.equal(error.status, status)
            assert.equal(error.retryable, retryable)
            assert.doesNotMatch(error.message, /fixture-event-key|Along the river/)
            return true
        })
    })
}

test('an empty provider acknowledgement cannot be reported as an accepted import', async () => {
    const client = createInngestClient(settings, async () => Response.json({ status: 200, ids: [] }))
    await assert.rejects(createArticlePublisher(client)(event), { code: 'QUEUE_ACKNOWLEDGEMENT_INVALID' })
})

test('a provider request deadline retains its timeout classification through the installed SDK', async () => {
    const client = createInngestClient(settings, async () => {
        throw new DOMException('fixture timeout', 'TimeoutError')
    })
    await assert.rejects(createArticlePublisher(client)(event), { code: 'QUEUE_TIMEOUT', retryable: true })
})

test('invalid article events fail at the queue boundary before making an HTTP request', async () => {
    let requests = 0
    const client = createInngestClient(settings, async () => {
        requests++
        return Response.json({ status: 200, ids: ['accepted-event'] })
    })
    await assert.rejects(
        async () => createArticlePublisher(client)({ ...event, data: { ...event.data, article: '' } }),
        {
            code: 'QUEUE_PAYLOAD_REJECTED',
            retryable: false,
        },
    )
    assert.equal(requests, 0)
})

test('preview and production deployments reject development queues before serving requests', () => {
    for (const VERCEL_ENV of ['preview', 'production'] satisfies ('preview' | 'production')[]) {
        assert.throws(() => createInngestClient({ ...settings, VERCEL_ENV, INNGEST_DEV: '1' }), {
            code: 'QUEUE_CONFIGURATION_INVALID',
        })
        assert.throws(
            () => createInngestClient({ ...settings, VERCEL_ENV, INNGEST_BASE_URL: 'http://localhost:8288' }),
            { code: 'QUEUE_CONFIGURATION_INVALID' },
        )
    }
})
