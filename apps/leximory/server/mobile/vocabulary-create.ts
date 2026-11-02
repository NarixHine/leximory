import { z } from 'zod'
import { createVocabularySchema, resourceID } from '@repo/api'
import { checkedResponse, jsonBody, query, type MobileOperation } from './http'
import { serializeWord } from './word-format'
import type { MobileSubject } from '@repo/schema/mobile'

export type AuthoredVocabulary = z.infer<typeof createVocabularySchema>
export interface VocabularyCreateStore {
    save(subject: MobileSubject, input: AuthoredVocabulary): Promise<{ id: string; libraryId: string }>
}
const savedSchema = z.object({ id: resourceID, libraryId: resourceID }).strict()
export function createVocabularyOperations(store: VocabularyCreateStore) {
    return {
        createVocabulary: async ({ request, subject, signal }) => {
            query(request, [])
            const input = createVocabularySchema.parse(await jsonBody(request, 100000, signal))
            serializeWord(input.fields)
            return checkedResponse(savedSchema, await store.save(subject, input))
        },
    } satisfies Record<string, MobileOperation>
}
