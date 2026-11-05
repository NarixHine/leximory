import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@repo/supabase/types'
import { mobileSubjectSchema } from '@repo/schema/mobile'
import type { CatalogStore, LibraryRow } from '../server/mobile/catalog'
import { createLibraryPreferenceStore } from '../server/mobile/library-preference-store'
import { createLibraryArchiveOperations } from '../server/mobile/library-preferences'
import { testMobileHandler } from './helpers/mobile'

const subject = mobileSubjectSchema.parse({ userId: 'reader' })
const library: LibraryRow = {
    id: 'folder',
    name: 'Books',
    lang: 'en',
    owner: 'reader',
    access: 0,
    starred_by: null,
    shadow: false,
}
const catalog: CatalogStore = {
    library: async () => library,
    libraries: async () => [],
    text: async () => null,
    texts: async () => [],
    archived: async () => [],
    audio: async () => null,
}
function archiveHandler(fetch: typeof globalThis.fetch) {
    const database = createClient<Database>('https://database.test', 'test-key', {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch },
    })
    return testMobileHandler(
        createLibraryArchiveOperations({ catalog, ...createLibraryPreferenceStore(database) }),
        async () => ({ kind: 'authenticated', subject }),
    )
}
function request(archived: boolean) {
    return new Request('https://leximory.test/api/mobile/v1/libraries/folder/archive', {
        method: 'POST',
        headers: { authorization: 'Bearer verified' },
        body: JSON.stringify({ archived }),
    })
}

test('archive initializes a missing native account profile through the installed Supabase client', async () => {
    let exists = false
    let archived: string[] | null = null
    const handler = archiveHandler(async (input, init) => {
        const url = new URL(String(input))
        assert.equal(url.pathname, '/rest/v1/users')
        if (init?.method === 'POST') {
            assert.equal(url.searchParams.get('on_conflict'), 'id')
            assert.match(new Headers(init.headers).get('prefer') ?? '', /resolution=ignore-duplicates/)
            assert.deepEqual(JSON.parse(String(init.body)), { id: 'reader', lexicoin: 20 })
            exists = true
            return new Response(null, { status: 201 })
        }
        assert.equal(url.searchParams.get('id'), 'eq.reader')
        if (init?.method === 'PATCH') {
            assert.ok(exists)
            assert.equal(url.searchParams.get('archived_libs'), 'is.null')
            assert.deepEqual(JSON.parse(String(init.body)), { archived_libs: ['folder'] })
            archived = ['folder']
            return Response.json([{ id: 'reader' }])
        }
        return Response.json(exists ? { archived_libs: archived } : null)
    })
    const response = await handler(request(true))
    assert.equal(response.status, 200, await response.clone().text())
    assert.deepEqual(await response.json(), { archived: true })
    assert.deepEqual(archived, ['folder'])
})

test('archive and unarchive preserve other folders and replay without writing twice', async () => {
    for (const [initial, archived, filter, expected] of [
        [null, true, 'is.null', ['folder']],
        [[], true, 'eq.{}', ['folder']],
        [['other'], true, 'eq.{"other"}', ['other', 'folder']],
        [['other', 'folder'], false, 'eq.{"other","folder"}', ['other']],
        [['folder', 'folder', 'other'], false, 'eq.{"folder","folder","other"}', ['other']],
    ] satisfies [string[] | null, boolean, string, string[]][]) {
        let stored = initial
        let writes = 0
        const handler = archiveHandler(async (input, init) => {
            const url = new URL(String(input))
            assert.equal(url.searchParams.get('id'), 'eq.reader')
            if (init?.method === 'PATCH') {
                writes++
                assert.equal(url.searchParams.get('archived_libs'), filter)
                const body = JSON.parse(String(init.body))
                assert.deepEqual(body, { archived_libs: expected })
                stored = expected
                return Response.json([{ id: 'reader' }])
            }
            assert.equal(init?.method, 'GET')
            return Response.json({ archived_libs: stored })
        })
        assert.equal((await handler(request(archived))).status, 200)
        assert.equal((await handler(request(archived))).status, 200)
        assert.deepEqual(stored, expected)
        assert.equal(writes, 1)
    }
})

test('archive rereads a conflicting update and merges with the winning folder change', async () => {
    let writes = 0
    const handler = archiveHandler(async (input, init) => {
        const url = new URL(String(input))
        if (init?.method !== 'PATCH') return Response.json({ archived_libs: writes ? ['other'] : [] })
        writes++
        if (writes === 1) {
            assert.equal(url.searchParams.get('archived_libs'), 'eq.{}')
            return Response.json([])
        }
        assert.equal(url.searchParams.get('archived_libs'), 'eq.{"other"}')
        assert.deepEqual(JSON.parse(String(init.body)), { archived_libs: ['other', 'folder'] })
        return Response.json([{ id: 'reader' }])
    })
    assert.equal((await handler(request(true))).status, 200)
    assert.equal(writes, 2)
})

test('database outages and malformed stored preferences fail without overwriting existing data', async () => {
    for (const response of [
        () => Response.json({ code: 'XX000', message: 'database unavailable' }, { status: 500 }),
        () => Response.json({ archived_libs: { invalid: true } }),
    ]) {
        let writes = 0
        const handler = archiveHandler(async (_input, init) => {
            if (init?.method !== 'GET') writes++
            return response()
        })
        const result = await handler(request(true))
        assert.equal(result.status, 503)
        assert.equal((await result.json()).error.retryable, true)
        assert.equal(writes, 0)
    }
})

test('the last concurrent writer can satisfy the archive request, otherwise conflicts are bounded', async () => {
    for (const satisfied of [true, false]) {
        let writes = 0
        let reads = 0
        const handler = archiveHandler(async (_input, init) => {
            if (init?.method === 'PATCH') {
                writes++
                return Response.json([])
            }
            reads++
            return Response.json({ archived_libs: writes === 3 && satisfied ? ['other', 'folder'] : ['other'] })
        })
        assert.equal((await handler(request(true))).status, satisfied ? 200 : 503)
        assert.equal(writes, 3)
        assert.equal(reads, 4)
    }
})

test('failed writes and malformed write receipts never acknowledge archive success', async () => {
    for (const receipt of [
        () => Response.json({ code: '42501', message: 'permission denied' }, { status: 403 }),
        () => Response.json([{ id: 'another-account' }]),
        () => Response.json(null),
    ]) {
        let writes = 0
        const handler = archiveHandler(async (_input, init) => {
            if (init?.method !== 'PATCH') return Response.json({ archived_libs: [] })
            writes++
            return receipt()
        })
        assert.equal((await handler(request(true))).status, 503)
        assert.equal(writes, 1)
    }
})

test('a lost archive response can be replayed without duplicating or undoing preferences', async () => {
    let stored = ['other']
    let writes = 0
    const handler = archiveHandler(async (_input, init) => {
        if (init?.method !== 'PATCH') return Response.json({ archived_libs: stored })
        writes++
        stored = ['other', 'folder']
        throw new TypeError('connection lost after commit')
    })
    assert.equal((await handler(request(true))).status, 503)
    assert.equal((await handler(request(true))).status, 200)
    assert.deepEqual(stored, ['other', 'folder'])
    assert.equal(writes, 1)
})

test('preference reads use the same validated state and never initialize accounts as a side effect', async () => {
    for (const [data, expected] of [
        [null, []],
        [{ archived_libs: null }, []],
        [{ archived_libs: ['folder'] }, ['folder']],
    ]) {
        const database = createClient<Database>('https://database.test', 'test-key', {
            auth: { persistSession: false, autoRefreshToken: false },
            global: {
                fetch: async (_input, init) => {
                    assert.equal(init?.method, 'GET')
                    return Response.json(data)
                },
            },
        })
        assert.deepEqual(
            await createLibraryPreferenceStore(database).archived('reader', new AbortController().signal),
            expected,
        )
    }
})
