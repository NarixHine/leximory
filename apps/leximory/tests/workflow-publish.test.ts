import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { z } from 'zod'
import { createWorkflowPublisher } from '../server/workflows/publish'

// Exercise the installed SDK and production publisher with only external HTTP replaced.
test('iOS job publishing preserves payloads, identities, retries and per-owner flow control', async () => {
    const messages: { destination: string; body: string; headers: Record<string, string> }[] = []
    let status = 200
    const server = createServer(async (request, response) => {
        assert.equal(request.url, '/v2/batch')
        assert.equal(request.headers.authorization, 'Bearer fixture-token')
        const parts = []
        for await (const part of request) parts.push(Buffer.from(part))
        const batch = JSON.parse(Buffer.concat(parts).toString())
        messages.push(...batch)
        response.writeHead(status, { 'content-type': 'application/json' })
        response.end(JSON.stringify(status === 200 ? [{ messageId: 'accepted' }] : { error: 'fixture rejection' }))
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    assert.ok(address && typeof address !== 'string')
    const publisher = createWorkflowPublisher({
        QSTASH_URL: `http://127.0.0.1:${address.port}`,
        QSTASH_TOKEN: 'fixture-token',
        NEXT_PUBLIC_LEXIMORY_URL: 'https://deployment.example',
        VERCEL_ENV: undefined,
    })
    try {
        const input = {
            id: 'article-stable-id',
            data: {
                article: 'Along the river.',
                userId: 'reader',
                textId: 'text',
                onlyComments: false,
                source: 'ios' as const,
            },
        }
        assert.deepEqual(await publisher.publishArticleImport(input), { eventId: 'wfr_article-stable-id' })
        await publisher.publishArticleImport(input)
        assert.deepEqual(messages[0], messages[1])
        assert.equal(messages[0]?.destination, 'https://deployment.example/api/workflows/ios/article-annotation')
        assert.deepEqual(JSON.parse(messages[0]!.body), input.data)
        const headers = new Headers(messages[0]!.headers)
        assert.equal(headers.get('upstash-retries'), '5')
        assert.match(headers.get('upstash-flow-control-key') ?? '', /^ios-article\.[a-f0-9]{64}$/)
        await publisher.publishAppleSubscription({ environment: 'Sandbox', chain: 'chain-1' }, 'notification-1')
        assert.equal(messages.at(-1)?.destination, 'https://deployment.example/api/workflows/ios/apple-subscription')
        assert.deepEqual(JSON.parse(messages.at(-1)!.body), { environment: 'Sandbox', chain: 'chain-1' })
        assert.match(
            new Headers(messages.at(-1)!.headers).get('upstash-flow-control-key') ?? '',
            /^apple\.[a-f0-9]{64}$/,
        )
        const requestId = '12345678-1234-4234-8234-123456789012'
        await publisher.publishAccountDeletion(requestId, 'attempt')
        assert.equal(messages.at(-1)?.destination, 'https://deployment.example/api/workflows/ios/account-deletion')
        assert.deepEqual(JSON.parse(messages.at(-1)!.body), { requestId })
        assert.match(JSON.stringify(messages.at(-1)!.headers), /parallelism=1/)
        const before = messages.length
        await assert.rejects(
            async () => publisher.publishArticleImport({ ...input, data: { ...input.data, article: '' } }),
            { code: 'QUEUE_PAYLOAD_REJECTED', retryable: false },
        )
        assert.equal(messages.length, before)
        for (const [failure, code, retryable] of [
            [401, 'QUEUE_AUTHENTICATION_REJECTED', false],
            [429, 'QUEUE_RATE_LIMITED', true],
            [503, 'QUEUE_UNAVAILABLE', true],
        ] as const) {
            status = failure
            await assert.rejects(publisher.publishArticleImport(input), { code, status: failure, retryable })
        }
    } finally {
        server.closeAllConnections()
        await new Promise<void>((resolve) => server.close(() => resolve()))
    }
})

test('hosted workflows reject development destinations', () => {
    assert.throws(
        () =>
            createWorkflowPublisher({
                QSTASH_URL: 'http://localhost:8080',
                QSTASH_TOKEN: 'fixture',
                NEXT_PUBLIC_LEXIMORY_URL: 'https://preview.example',
                VERCEL_ENV: 'preview',
            }),
        { code: 'QUEUE_CONFIGURATION_INVALID' },
    )
})

test(
    'the local QStash server accepts and delivers production workflow requests',
    {
        skip: !process.env.QSTASH_LOCAL_TEST_URL,
        timeout: 15000,
    },
    async () => {
        const localURL = process.env.QSTASH_LOCAL_TEST_URL
        const token = process.env.QSTASH_LOCAL_TEST_TOKEN
        assert.ok(localURL)
        assert.ok(token)
        const origin = new URL(localURL)
        assert.equal(origin.hostname, '127.0.0.1', 'this integration check must never publish to a live queue')
        const deliveries: { path: string; payload: unknown }[] = []
        const delivered = Promise.withResolvers<void>()
        const server = createServer(async (request, response) => {
            const parts: Buffer[] = []
            for await (const part of request) parts.push(Buffer.from(part))
            const [initial] = z
                .tuple([z.object({ body: z.string(), callType: z.literal('step') })])
                .parse(JSON.parse(Buffer.concat(parts).toString()))
            deliveries.push({
                path: request.url ?? '',
                payload: JSON.parse(Buffer.from(initial.body, 'base64').toString()),
            })
            response.writeHead(200, { 'content-type': 'application/json' })
            response.end('{}')
            if (deliveries.length === 3) delivered.resolve()
        })
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
        const address = server.address()
        assert.ok(address && typeof address !== 'string')
        const publisher = createWorkflowPublisher({
            QSTASH_URL: origin.href,
            QSTASH_TOKEN: token,
            NEXT_PUBLIC_LEXIMORY_URL: `http://127.0.0.1:${address.port}`,
            VERCEL_ENV: undefined,
        })
        const timeout = setTimeout(
            () => delivered.reject(new Error('QStash did not deliver the fixture workflows')),
            10000,
        )
        try {
            const identity = crypto.randomUUID()
            await publisher.publishArticleImport({
                id: identity + '-article',
                data: {
                    article: 'Along the river.',
                    userId: 'local-test-reader',
                    textId: 'local-test-text',
                    onlyComments: false,
                },
            })
            await publisher.publishAppleSubscription(
                { environment: 'Sandbox', chain: 'local-test-chain' },
                identity + '-apple',
            )
            await publisher.publishAccountDeletion(identity, 'local-test')
            await delivered.promise
            assert.deepEqual(
                deliveries.sort((a, b) => a.path.localeCompare(b.path)),
                [
                    { path: '/api/workflows/ios/account-deletion', payload: { requestId: identity } },
                    {
                        path: '/api/workflows/ios/apple-subscription',
                        payload: { environment: 'Sandbox', chain: 'local-test-chain' },
                    },
                    {
                        path: '/api/workflows/ios/article-annotation',
                        payload: {
                            article: 'Along the river.',
                            userId: 'local-test-reader',
                            textId: 'local-test-text',
                            onlyComments: false,
                        },
                    },
                ],
            )
        } finally {
            clearTimeout(timeout)
            server.closeAllConnections()
            await new Promise<void>((resolve) => server.close(() => resolve()))
        }
    },
)
