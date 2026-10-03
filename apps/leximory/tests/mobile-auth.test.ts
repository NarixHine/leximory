import assert from 'node:assert/strict'
import test from 'node:test'
import { canReadLibrary, canWriteLibrary, type LibraryReadAccess } from '@repo/service/access'
import { mobileErrorSchema } from '@repo/schema/mobile'
import { createSupabaseBearerVerifier, requireMobileSubject } from '../server/mobile/auth'
import { MobileError, mobileErrorResponse } from '../server/mobile/errors'

const library: LibraryReadAccess = { owner: 'owner', access: 1, starred_by: ['reader'] }
const policyCases: [string, { userId: string } | null, LibraryReadAccess | null, boolean, boolean][] = [
    ['owner of private library', { userId: 'owner' }, { ...library, access: 0 }, true, true],
    ['starred public library', { userId: 'reader' }, library, true, false],
    ['unstarred public library', { userId: 'stranger' }, library, false, false],
    ['formerly public library', { userId: 'reader' }, { ...library, access: 0 }, false, false],
    ['unknown access value', { userId: 'reader' }, { ...library, access: -1 }, false, false],
    ['anonymous reader', null, library, false, false],
    ['missing parent library', { userId: 'owner' }, null, false, false],
]
for (const [name, subject, resource, readable, writable] of policyCases) {
    test(`shared web/mobile policy: ${name}`, () => {
        assert.equal(canReadLibrary(subject, resource), readable)
        assert.equal(canWriteLibrary(subject, resource), writable)
    })
}

test('bearer verification uses the configured Auth server and its returned subject', async () => {
    let calls = 0
    const verify = createSupabaseBearerVerifier({
        url: 'https://project.fixture.invalid', anonKey: 'fixture-public-key',
        fetcher: async (input, init) => {
            calls += 1
            assert.equal(String(input), 'https://project.fixture.invalid/auth/v1/user')
            const headers = new Headers(init?.headers)
            assert.equal(headers.get('Authorization'), 'Bearer valid.fixture.token')
            assert.equal(headers.get('apikey'), 'fixture-public-key')
            assert.equal(headers.get('cookie'), null)
            assert.equal(init?.cache, 'no-store')
            return Response.json({ id: 'verified-reader' })
        },
    })
    const request = new Request('https://leximory.fixture.invalid/api/mobile/v1/me', {
        headers: { Authorization: 'Bearer valid.fixture.token', Cookie: 'userId=forged-owner' },
    })
    const subject = await requireMobileSubject(request, verify)
    assert.equal(subject.userId, 'verified-reader')
    assert.equal(calls, 1)
    assert.equal(canWriteLibrary(subject, library), false)
})

for (const authorization of [undefined, '', 'Basic token', 'Bearer', 'Bearer a, Bearer b', 'Bearer a b', `Bearer ${'a'.repeat(16385)}`]) {
    test(`missing or malformed bearer never falls back to cookies: ${authorization?.slice(0, 24) ?? 'absent'}`, async () => {
        const headers = new Headers({ Cookie: 'sb-session=pretend-valid-session' })
        if (authorization !== undefined) headers.set('Authorization', authorization)
        await assert.rejects(requireMobileSubject(new Request('https://fixture.invalid', { headers }), async () => {
            assert.fail('Verification must not run without one valid bearer credential')
        }), error => error instanceof MobileError && error.code === 'unauthenticated')
    })
}

for (const token of ['expired.fixture.token', 'wrong-project.fixture.token', 'unsigned.fixture.token']) {
    test(`Auth server rejection is respected: ${token}`, async () => {
        const verify = createSupabaseBearerVerifier({
            url: 'https://project.fixture.invalid', anonKey: 'fixture-public-key',
            fetcher: async (_, init) => {
                assert.equal(new Headers(init?.headers).get('Authorization'), `Bearer ${token}`)
                return Response.json({ message: 'invalid token', error_code: 'bad_jwt' }, { status: 401 })
            },
        })
        await assert.rejects(requireMobileSubject(new Request('https://fixture.invalid', {
            headers: { Authorization: `Bearer ${token}` },
        }), verify), error => error instanceof MobileError && error.code === 'unauthenticated')
    })
}

test('Auth service failure is recoverable and does not pretend the token is expired', async () => {
    const verify = createSupabaseBearerVerifier({
        url: 'https://project.fixture.invalid', anonKey: 'fixture-public-key',
        fetcher: async () => Response.json({ message: 'temporarily unavailable' }, { status: 429 }),
    })
    await assert.rejects(requireMobileSubject(new Request('https://fixture.invalid', {
        headers: { Authorization: 'Bearer fixture.token' },
    }), verify), error => error instanceof MobileError && error.code === 'service_unavailable')
})

test('HTTP failures are typed private JSON without redirects or exception details', async () => {
    const unauthorized = mobileErrorResponse(new MobileError('unauthenticated'))
    assert.equal(unauthorized.status, 401)
    assert.equal(unauthorized.headers.get('WWW-Authenticate'), 'Bearer')
    assert.equal(unauthorized.headers.get('Location'), null)
    assert.equal(unauthorized.headers.get('Cache-Control'), 'private, no-store')
    assert.equal(mobileErrorSchema.parse(await unauthorized.json()).error.code, 'unauthenticated')
    const unexpected = mobileErrorResponse(new Error('secret internal URL or token'))
    assert.equal(unexpected.status, 503)
    const body = mobileErrorSchema.parse(await unexpected.json())
    assert.equal(body.error.retryable, true)
    assert.equal(body.error.message.includes('secret'), false)
})
