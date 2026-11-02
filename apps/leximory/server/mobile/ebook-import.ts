import { z } from 'zod'
import { ebookImportSuggestionSchema } from '@repo/api'
import type { MobileSubject } from '@repo/schema/mobile'
import { checkedResponse, jsonBody, type MobileOperation } from './http'

export type EbookImportInput = z.infer<typeof ebookImportSuggestionSchema>
export const ebookImportResultSchema = z.object({ value: z.string().trim().min(1).max(512).nullable() }).strict()
export type EbookImportFolder = { id: string; name: string; language: string; titles: string[] }
export interface EbookImportStore {
    folders(subject: MobileSubject, signal: AbortSignal): Promise<EbookImportFolder[]>
    suggest(
        subject: MobileSubject,
        input: EbookImportInput,
        folders: EbookImportFolder[],
        signal: AbortSignal,
    ): Promise<unknown>
}
export function createEbookImportOperations(store: EbookImportStore) {
    const suggestEbookImport: MobileOperation = async ({ request, subject, signal }) => {
        const input = ebookImportSuggestionSchema.parse(await jsonBody(request, 64000, signal))
        const folders = await store.folders(subject, signal)
        const result = checkedResponse(ebookImportResultSchema, await store.suggest(subject, input, folders, signal))
        if (input.field === 'folder' && !folders.some((folder) => folder.id === result.value)) return { value: null }
        return result
    }
    return { suggestEbookImport }
}
