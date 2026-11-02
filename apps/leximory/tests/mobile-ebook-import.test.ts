import { test } from 'node:test'
import { mobileSubjectSchema } from '@repo/schema/mobile'
import assert from 'node:assert/strict'
import { createEbookImportOperations, type EbookImportStore } from '../server/mobile/ebook-import'
import { testMobileHandler } from './helpers/mobile'

function harness(overrides: Partial<EbookImportStore> = {}) {
    const calls: string[] = []
    const store: EbookImportStore = {
        folders: async (subject) => {
            calls.push(subject.userId)
            return [{ id: 'books', name: 'Novels', language: 'en', titles: ['The River — M. Field'] }]
        },
        suggest: async (_subject, input) => ({ value: input.field === 'title' ? 'The Forest — M. Field' : 'books' }),
        ...overrides,
    }
    const handler = testMobileHandler(createEbookImportOperations(store), async () => ({
        kind: 'authenticated',
        subject: mobileSubjectSchema.parse({ userId: 'reader' }),
    }))
    return {
        calls,
        request: (input: Record<string, unknown> = {}) =>
            handler(
                new Request('http://localhost/api/mobile/v1/ebooks/import-suggestion', {
                    method: 'POST',
                    headers: { authorization: 'Bearer test', 'content-type': 'application/json' },
                    body: JSON.stringify({
                        requestId: 'request',
                        field: 'title',
                        filename: 'download.epub',
                        title: 'The Forest',
                        author: 'M. Field',
                        language: 'en',
                        sample: 'A forest beside the river.',
                        ...input,
                    }),
                }),
            ),
    }
}
test('ebook suggestions get their library context from the authenticated account', async () => {
    const h = harness()
    const response = await h.request()
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { value: 'The Forest — M. Field' })
    assert.deepEqual(h.calls, ['reader'])
})
test('a folder suggestion cannot select a folder outside the authorized candidates', async () => {
    const h = harness({ suggest: async () => ({ value: 'someone-elses-library' }) })
    const response = await h.request({ field: 'folder' })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { value: null })
})
test('uncertain suggestions leave the manual choice available', async () => {
    const response = await harness({ suggest: async () => ({ value: null }) }).request({ field: 'folder' })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { value: null })
})
test('ebook suggestion inputs and model outputs are bounded at the HTTP boundary', async () => {
    assert.equal((await harness().request({ sample: 'x'.repeat(8001) })).status, 400)
    assert.equal((await harness().request({ field: 'rename' })).status, 400)
    assert.equal((await harness({ suggest: async () => ({ value: 'x'.repeat(513) }) }).request()).status, 503)
})

test('production context includes every unarchived library and an independent sample of ebook names', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const { ebookImportFolders } = await import('../server/mobile/ebook-import-context')
    const requests: URL[] = []
    const libraries = Array.from({ length: 205 }, (_, index) => ({
        id: `library-${String(index).padStart(3, '0')}`,
        name: `Collection ${index}`,
        lang: 'en',
    }))
    const database = createClient('https://database.test', 'test-key', {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
            fetch: async (input) => {
                const url = new URL(String(input))
                requests.push(url)
                if (url.pathname.endsWith('/users')) return Response.json({ archived_libs: ['library-000'] })
                if (url.pathname.endsWith('/libraries')) {
                    const start = Number(url.searchParams.get('offset') ?? 0)
                    return Response.json(libraries.slice(start, start + Number(url.searchParams.get('limit'))))
                }
                const id = url.searchParams.get('lib')?.replace(/^eq\./, '')
                return Response.json(
                    id === 'library-204'
                        ? []
                        : Array.from({ length: 6 }, (_, index) => ({ title: `${id} book ${index}` })),
                )
            },
        },
    })
    const result = await ebookImportFolders(database)(
        mobileSubjectSchema.parse({ userId: 'reader' }),
        new AbortController().signal,
    )
    assert.equal(result.length, 204)
    assert.equal(
        result.some((folder) => folder.id === 'library-000'),
        false,
    )
    assert.deepEqual(
        result.find((folder) => folder.id === 'library-203')?.titles,
        Array.from({ length: 6 }, (_, index) => `library-203 book ${index}`),
    )
    assert.deepEqual(result.find((folder) => folder.id === 'library-204')?.titles, [])
    const folderRequests = requests.filter((url) => url.pathname.endsWith('/libraries'))
    assert.equal(folderRequests.length, 2)
    for (const url of folderRequests) {
        assert.equal(url.searchParams.get('owner'), 'eq.reader')
        assert.equal(url.searchParams.get('shadow'), 'eq.false')
        assert.equal(url.searchParams.has('id'), false)
    }
    const samples = requests.filter((url) => url.pathname.endsWith('/texts'))
    assert.equal(samples.length, 204)
    assert.equal(
        samples.some((url) => url.searchParams.get('lib') === 'eq.library-000'),
        false,
    )
    for (const url of samples) {
        assert.equal(url.searchParams.get('has_ebook'), 'eq.true')
        assert.equal(url.searchParams.get('limit'), '6')
    }
})
