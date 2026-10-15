import assert from 'node:assert/strict'
import { test } from 'node:test'
import { z } from 'zod'
import { mobileSubjectSchema } from '@repo/schema/mobile'
import { mobileEndpoint, jsonBody, query, checkedResponse } from '../server/mobile/http'

const subject = mobileSubjectSchema.parse({ userId: 'reader' })
const verify = async () => ({ kind: 'authenticated' as const, subject })
test('authenticated static routes accept Next.js context without dynamic params', async () => {
    const endpoint = mobileEndpoint(verify, async ({ params, subject }) => ({ params, userId: subject.userId }))
    const response = await endpoint(
        new Request('https://leximory.test/api/mobile/v1/me', { headers: { authorization: 'Bearer verified' } }),
        { params: undefined },
    )
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { params: {}, userId: 'reader' })
})
function request(body: string, headers: Record<string, string> = {}) {
    return new Request('https://leximory.test/api/mobile/v1/example', {
        method: 'POST',
        body,
        headers: { authorization: 'Bearer verified', ...headers },
    })
}
test('the HTTP boundary authenticates before parsing or running an operation', async () => {
    let calls = 0
    const endpoint = mobileEndpoint(verify, async () => {
        calls++
        return {}
    })
    const response = await endpoint(new Request('https://leximory.test', { headers: { cookie: 'session=forged' } }))
    assert.equal(response.status, 401)
    assert.equal(response.headers.get('www-authenticate'), 'Bearer')
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.equal(calls, 0)
})
test('client validation is 400 while provider validation is 503', async () => {
    const schema = z.object({ value: z.string() }).strict()
    const client = mobileEndpoint(verify, async (context) => schema.parse(await jsonBody(context.request)))
    const provider = mobileEndpoint(verify, async () => checkedResponse(schema, { value: 7 }))
    assert.equal((await client(request('{'))).status, 400)
    assert.equal((await client(request('{"value":7}'))).status, 400)
    assert.equal((await provider(request('{}'))).status, 503)
})
test('actual body bytes are bounded even without a content-length header', async () => {
    const endpoint = mobileEndpoint(verify, async (context) => jsonBody(context.request, 10, context.signal))
    assert.equal((await endpoint(request('{"x":"1234567890"}'))).status, 400)
    assert.equal((await endpoint(request('{"x":1}'))).status, 200)
    assert.equal((await endpoint(request('{"x":1}', { 'content-length': '11' }))).status, 400)
})
test('query parsing rejects repeated and unknown keys', () => {
    for (const suffix of ['?cursor=one&cursor=two', '?owner=forged']) {
        assert.throws(() => query(new Request('https://leximory.test' + suffix), ['cursor']), { code: 'invalid_input' })
    }
})
test('aborted work never reaches the operation and error responses keep a diagnostic identity', async () => {
    let calls = 0
    const endpoint = mobileEndpoint(verify, async () => {
        calls++
        return {}
    })
    const abort = new AbortController()
    abort.abort()
    const response = await endpoint(
        new Request('https://leximory.test', {
            signal: abort.signal,
            headers: { authorization: 'Bearer verified', 'X-Leximory-Request-ID': 'known-request' },
        }),
    )
    assert.equal(response.status, 503)
    assert.equal(response.headers.get('X-Leximory-Request-ID'), 'known-request')
    assert.equal(calls, 0)
})
