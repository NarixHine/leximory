import { createHash } from 'node:crypto'
import { MobileError } from './errors'

export function mobileMutationID(...parts: string[]): string {
    const hash = createHash('sha256').update(JSON.stringify(['leximory-mobile-v1', ...parts])).digest('hex')
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`
}

type SavedVocabulary = { id: string; libraryId: string }
export interface VocabularySaveStore {
    lookup(id: string): Promise<(SavedVocabulary & { owner: string | null }) | null>
    destination(): Promise<string>
    insertIfAbsent(id: string, libraryId: string): Promise<void>
}

export async function saveVocabularyOnce(
    input: { userId: string; sourceLibrary: string; requestId: string },
    store: VocabularySaveStore,
): Promise<SavedVocabulary> {
    const id = mobileMutationID('vocabulary', input.userId, input.sourceLibrary, input.requestId)
    const existing = await store.lookup(id)
    if (existing) {
        if (existing.owner !== input.userId) throw new MobileError('inaccessible')
        return { id: existing.id, libraryId: existing.libraryId }
    }
    const libraryId = await store.destination()
    // The existing primary key prevents duplicates even if the first response is lost or requests overlap.
    await store.insertIfAbsent(id, libraryId)
    const saved = await store.lookup(id)
    if (!saved || saved.owner !== input.userId) throw new MobileError('inaccessible')
    return { id: saved.id, libraryId: saved.libraryId }
}
