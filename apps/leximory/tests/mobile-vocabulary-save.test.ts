import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mobileMutationID, saveVocabularyOnce, type VocabularySaveStore } from '../server/mobile/vocabulary-save'

const input = { userId: 'reader', sourceLibrary: 'source', requestId: 'request' }
function harness() {
    const rows = new Map<string, { id: string; libraryId: string; owner: string; definition: string }>()
    let inserts = 0
    const store: VocabularySaveStore = {
        lookup: async id => rows.get(id) ?? null,
        destination: async () => 'destination',
        insertIfAbsent: async (id, libraryId) => {
            inserts++
            if (!rows.has(id)) rows.set(id, { id, libraryId, owner: input.userId, definition: 'original' })
        },
    }
    return { rows, store, inserts: () => inserts }
}
test('replaying a lost response returns the original word without replacing later edits', async () => {
    const h = harness()
    const first = await saveVocabularyOnce(input, h.store)
    h.rows.get(first.id)!.definition = 'edited'
    h.store.destination = async () => { throw new Error('Replay must not create a destination') }
    assert.deepEqual(await saveVocabularyOnce(input, h.store), first)
    assert.equal(h.rows.size, 1)
    assert.equal(h.inserts(), 1)
    assert.equal(h.rows.get(first.id)?.definition, 'edited')
})
test('overlapping requests insert one word and return the same identity', async () => {
    const h = harness()
    const results = await Promise.all(Array.from({ length: 8 }, () => saveVocabularyOnce(input, h.store)))
    assert.equal(h.rows.size, 1)
    for (const result of results) assert.deepEqual(result, results[0])
})
test('retry after a committed insert throws returns the committed row', async () => {
    const h = harness()
    const insert = h.store.insertIfAbsent
    h.store.insertIfAbsent = async (id, libraryId) => { await insert(id, libraryId); throw new Error('response lost') }
    await assert.rejects(saveVocabularyOnce(input, h.store))
    const saved = await saveVocabularyOnce(input, h.store)
    assert.equal(saved.id, [...h.rows.keys()][0])
    assert.equal(h.inserts(), 1)
})
test('mutation identities separate accounts, sources and requests', () => {
    const id = mobileMutationID('vocabulary', 'reader', 'source', 'request')
    assert.match(id, /^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-a[a-f0-9]{3}-[a-f0-9]{12}$/)
    for (const parts of [['other', 'source', 'request'], ['reader', 'other', 'request'], ['reader', 'source', 'other']]) {
        assert.notEqual(mobileMutationID('vocabulary', ...parts), id)
    }
})
test('a replay never returns a row owned by a different account', async () => {
    const h = harness()
    const saved = await saveVocabularyOnce(input, h.store)
    h.rows.get(saved.id)!.owner = 'other'
    await assert.rejects(saveVocabularyOnce(input, h.store), { code: 'inaccessible' })
})
