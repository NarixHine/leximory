import { z } from '@repo/schema'

/**
 * A single chunk entry with English and Chinese text.
 */
export const ChunkEntrySchema = z.object({
    english: z.string(),
    chinese: z.string(),
})

export type ChunkEntry = z.infer<typeof ChunkEntrySchema>

/**
 * A section of chunks with a section name and entries.
 */
export const ChunkSectionSchema = z.object({
    sectionName: z.string(),
    sectionType: z.string(),
    entries: z.array(ChunkEntrySchema),
})

export type ChunkSection = z.infer<typeof ChunkSectionSchema>

/**
 * The full dictation content containing all sections.
 */
export const DictationContentSchema = z.object({
    sections: z.array(ChunkSectionSchema),
})

export type DictationContent = z.infer<typeof DictationContentSchema>

/**
 * Schema for the AI-generated chunk response per section.
 */
export const ChunkGenerationResponseSchema = z.object({
    entries: z.array(ChunkEntrySchema),
})

export type ChunkGenerationResponse = z.infer<typeof ChunkGenerationResponseSchema>

/**
 * The content structure for a chunk note (stored as JSON string in DB).
 * Contains the English and Chinese pair.
 */
export interface ChunkNoteContent {
    english: string
    chinese: string
}

/**
 * Serializes the chunk note content to JSON string.
 */
export function serializeChunkNoteContent(content: ChunkNoteContent): string {
    return JSON.stringify(content)
}

/**
 * Parses a chunk note content from JSON string.
 */
export function parseChunkNoteContent(content: string): ChunkNoteContent | null {
    try {
        const parsed = JSON.parse(content)
        if (typeof parsed.english === 'string' && typeof parsed.chinese === 'string') {
            return parsed as ChunkNoteContent
        }
        return null
    } catch {
        return null
    }
}
