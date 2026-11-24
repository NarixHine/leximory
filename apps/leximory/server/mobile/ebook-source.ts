import 'server-only'
import type { redis } from '@repo/kv/redis'
import { z } from 'zod'
import { mobileMutationID } from './vocabulary-save'
import { checkedResponse } from './http'

const ebookSourceSchema = z
    .object({
        id: z.string().regex(/^[a-f0-9-]+$/),
        format: z.enum(['pdf', 'epub']),
        publishedAt: z.iso.datetime(),
    })
    .strict()

export type EbookSource = z.infer<typeof ebookSourceSchema>
export const ebookSourceKey = (textId: string) => `ebook:source:${textId}`
export const ebookVersionPrefix = (textId: string) => mobileMutationID('ebook-asset', textId) + '--'
export const ebookVersionPath = (textId: string, source: Pick<EbookSource, 'id' | 'format'>) =>
    `ebooks/${ebookVersionPrefix(textId)}${source.id}.${source.format}`

export async function readEbookSource(state: Pick<typeof redis, 'get'>, textId: string) {
    return checkedResponse(ebookSourceSchema.nullable(), await state.get(ebookSourceKey(textId)))
}

export function ebookSourceCandidates(textId: string, source: EbookSource | null) {
    if (source) return [{ format: source.format, path: ebookVersionPath(textId, source) }]
    return (['pdf', 'epub'] as const).map((format) => ({ format, path: `ebooks/${textId}.${format}` }))
}
