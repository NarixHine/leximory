import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { releaseConfigSchema, verifyMobileRelease } from '../scripts/lib/mobile-release'

const config = releaseConfigSchema.parse({
    origin: 'https://release.fixture.invalid',
    supabaseURL: 'https://auth.fixture.invalid',
    anonKey: 'fixture',
    email: 'ci@example.invalid',
    password: 'fixture',
    userId: '11111111-1111-4111-8111-111111111111',
    libraryId: 'fixture-library',
    allowWrites: 'true',
    expectedRevision: 'a'.repeat(40),
})
function fixture(
    options: {
        namespace?: string
        completed?: boolean
        rejected?: boolean
        noDefinitions?: boolean
        doubleCharge?: boolean
        archiveIgnored?: boolean
        cleanupRejected?: boolean
        noMetadata?: boolean
    } = {},
) {
    let archived = false
    let used = 0
    let title = ''
    let exists = false
    let requestId: unknown
    const writes: string[] = []
    const text = () => ({
        id: 'fixture-article',
        libraryId: config.libraryId,
        title,
        topics: options.noMetadata ? [] : ['Reading'],
        emoji: options.noMetadata ? null : '🌿',
        createdAt: null,
        format: 'article',
    })
    const service: typeof fetch = async (input, init) => {
        const path = new URL(String(input)).pathname.replace('/api/mobile/v1/', '')
        const body = init?.body ? JSON.parse(String(init.body)) : undefined
        if (body !== undefined) writes.push(path)
        if (path === 'me')
            return Response.json({
                userId: config.userId,
                plan: 'beginner',
                definitions: { used, limit: 20, resetsIn: 1000 },
            })
        if (path === 'libraries')
            return Response.json({
                items: [
                    {
                        id: config.libraryId,
                        name: options.namespace ?? '__leximory_e2e__Reading',
                        language: 'en',
                        owned: true,
                        archived,
                        shadow: false,
                    },
                ],
                nextCursor: null,
            })
        if (path.endsWith('/articles')) {
            title = body.title
            exists = true
            if (requestId === undefined) {
                requestId = body.requestId
                used += options.doubleCharge ? 2 : 1
            } else assert.equal(body.requestId, requestId)
            return options.rejected
                ? Response.json(
                      { error: 'rejected' },
                      { status: 503, headers: { 'x-leximory-request-id': 'rejected-release' } },
                  )
                : Response.json(text())
        }
        if (path === 'texts/fixture-article')
            return Response.json({
                text: text(),
                library: {
                    id: config.libraryId,
                    name: '__leximory_e2e__Reading',
                    language: 'en',
                    owned: true,
                    archived,
                    shadow: false,
                },
                annotationProgress: options.completed === false ? 'annotating' : 'completed',
                document: {
                    version: 1,
                    revision: 'a'.repeat(64),
                    source: '{{bank||bank||河岸}}',
                    blocks: [
                        {
                            id: 'block',
                            kind: 'paragraph',
                            sourceRange: { location: 0, length: 4 },
                            displayText: 'bank',
                            audioId: null,
                            notice: null,
                            spans: options.noDefinitions
                                ? []
                                : [
                                      {
                                          kind: 'definition',
                                          range: { location: 0, length: 4 },
                                          lemma: 'bank',
                                          definition: '河岸',
                                          etymology: null,
                                          cognates: null,
                                      },
                                  ],
                        },
                    ],
                },
            })
        if (path.endsWith('/texts')) return Response.json({ items: exists ? [text()] : [], nextCursor: null })
        if (path.endsWith('/remove')) {
            if (options.cleanupRejected) return Response.json({}, { status: 503 })
            exists = false
            return Response.json({ removed: true })
        }
        if (path.endsWith('/archive')) {
            archived = options.archiveIgnored ? false : body.archived
            return Response.json({ archived })
        }
        throw Error('Unexpected release request')
    }
    const fetcher: typeof fetch = async (input, init) => {
        const response = await service(input, init)
        response.headers.set('x-leximory-revision', config.expectedRevision)
        return response
    }
    return { fetcher, writes, archived: () => archived, exists: () => exists }
}

test('the release command fails closed without explicit isolated credentials', () => {
    const env = { ...process.env }
    for (const key of Object.keys(env)) if (key.startsWith('BACKEND_E2E_')) delete env[key]
    const result = spawnSync(
        process.execPath,
        ['--import', 'tsx', fileURLToPath(new URL('../scripts/verify-mobile-release.ts', import.meta.url))],
        { env, encoding: 'utf8' },
    )
    assert.equal(result.status, 1)
    assert.match(result.stderr, /not_verified/)
    assert.match(result.stderr, /configuration/)
})

test('the release verifier refuses a normal user folder before making any mutation', async () => {
    const f = fixture({ namespace: 'My reading' })
    await assert.rejects(
        verifyMobileRelease({ config, accessToken: 'fixture', fetcher: f.fetcher }),
        /dedicated English verification folder/,
    )
    assert.deepEqual(f.writes, [])
})

test('queue acceptance alone cannot produce a verified release and the saved fixture is cleaned', async () => {
    const f = fixture({ completed: false })
    await assert.rejects(
        verifyMobileRelease({ config, accessToken: 'fixture', fetcher: f.fetcher, timeoutMs: 0 }),
        /never completed/,
    )
    assert.equal(f.exists(), false)
})

test('a rejected import cleans a saved fixture even when its response never returned the ID', async () => {
    const f = fixture({ rejected: true })
    await assert.rejects(verifyMobileRelease({ config, accessToken: 'fixture', fetcher: f.fetcher }), /HTTP 503/)
    assert.equal(f.exists(), false)
})

test('only completion, quota, replay, archive and cleanup checks can produce verified status', async () => {
    const f = fixture()
    const result = await verifyMobileRelease({ config, accessToken: 'fixture', fetcher: f.fetcher })
    assert.equal(result.status, 'verified')
    assert.deepEqual(result.checks, [
        'deployment-revision',
        'account-isolation',
        'import-acceptance',
        'idempotent-replay',
        'annotation-completion',
        'quota-charged-once',
        'archive-round-trip',
        'fixture-cleanup',
    ])
    assert.equal(f.exists(), false)
    assert.equal(f.archived(), false)
})

test('a working deployment of another revision cannot verify this release', async () => {
    const f = fixture()
    await assert.rejects(
        verifyMobileRelease({
            config: { ...config, expectedRevision: 'b'.repeat(40) },
            accessToken: 'fixture',
            fetcher: f.fetcher,
        }),
        /expected revision/,
    )
    assert.deepEqual(f.writes, [])
})

for (const [name, options, reason] of [
    ['empty generated definitions', { noDefinitions: true }, /without generated definitions/],
    ['duplicate quota charge', { doubleCharge: true }, /exactly one annotation quota/],
    ['archive write without persistence', { archiveIgnored: true }, /not reflected by the catalog/],
    ['unconfirmed fixture cleanup', { cleanupRejected: true }, /Cleanup not confirmed/],
] satisfies [string, Parameters<typeof fixture>[0], RegExp][]) {
    test(`${name} cannot produce a verified release`, async () => {
        const f = fixture(options)
        await assert.rejects(verifyMobileRelease({ config, accessToken: 'fixture', fetcher: f.fetcher }), reason)
        assert.equal(f.archived(), false, 'archive state must be restored even if cleanup fails')
    })
}

test('optional topics and emoji cannot reject an otherwise completed annotated import', async () => {
    const f = fixture({ noMetadata: true })
    const result = await verifyMobileRelease({ config, accessToken: 'fixture', fetcher: f.fetcher })
    assert.equal(result.status, 'verified')
    assert.equal(f.exists(), false)
    assert.equal(f.archived(), false)
})
