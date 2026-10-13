import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mobileSubjectSchema } from '@repo/schema/mobile'
import { createFolderHandler, type FolderStore } from '../server/mobile/folders'
import type { CatalogStore, LibraryRow } from '../server/mobile/catalog'

const subject = mobileSubjectSchema.parse({ userId: 'reader' })
const owned: LibraryRow = { id: 'folder', name: 'Reading', lang: 'en', owner: 'reader', access: 0, starred_by: null, shadow: false }
function harness(library = owned) {
    const writes: unknown[] = []
    const catalog: CatalogStore = {
        library: async () => library, text: async () => null, libraries: async () => [library],
        texts: async () => [], archived: async () => ['folder'], audio: async () => null,
    }
    const folders: FolderStore = {
        create: async (_, input) => { writes.push(input); return { ...owned, name: input.name, lang: input.language } },
        rename: async (existing, name) => { writes.push(name); return { ...existing, name } },
    }
    return { writes, handler: createFolderHandler({ verify: async () => ({ kind: 'authenticated', subject }), catalog, folders }) }
}
function request(path: string, body: unknown, authenticated = true) {
    return new Request('https://leximory.test/api/mobile/v1/' + path, { method: 'POST',
        headers: authenticated ? { authorization: 'Bearer verified' } : {}, body: JSON.stringify(body) })
}
test('folder creation preserves language and request identity and returns the native catalog shape', async () => {
    const h = harness()
    const response = await h.handler(request('libraries', { name: ' 日本語 ', language: 'ja', requestId: 'new-folder' }))
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { id: 'folder', name: '日本語', language: 'ja', owned: true, archived: true, shadow: false })
    assert.deepEqual(h.writes, [{ name: '日本語', language: 'ja', requestId: 'new-folder' }])
})
test('rename changes only the name and preserves language and archive categorization', async () => {
    const h = harness()
    const response = await h.handler(request('libraries/folder/name', { name: 'New name' }))
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { id: 'folder', name: 'New name', language: 'en', owned: true, archived: true, shadow: false })
})
test('unauthenticated, shared, and warehouse mutations never write', async () => {
    const unauthenticated = harness()
    assert.equal((await unauthenticated.handler(request('libraries', { name: 'Test', language: 'en', requestId: 'new' }, false))).status, 401)
    assert.deepEqual(unauthenticated.writes, [])
    for (const library of [{ ...owned, owner: 'other', access: 1 }, { ...owned, shadow: true }]) {
        const h = harness(library)
        assert.equal((await h.handler(request('libraries/folder/name', { name: 'Renamed' }))).status, 404)
        assert.deepEqual(h.writes, [])
    }
})
test('invalid language, empty names, unknown fields, and oversized bodies are rejected before a write', async () => {
    for (const input of [
        { name: '', language: 'en', requestId: 'new' },
        { name: 'Test', language: 'invalid', requestId: 'new' },
        { name: 'Test', language: 'en', requestId: 'new', owner: 'other' },
        { name: 'x'.repeat(5000), language: 'en', requestId: 'new' },
    ]) {
        const h = harness()
        assert.equal((await h.handler(request('libraries', input))).status, 400)
        assert.deepEqual(h.writes, [])
    }
})
