import { z } from 'zod'
import { ebookSchema, ebookBookmarkSchema, resourceID } from '@repo/api'
import { createCatalog, summarizeText, summarizeLibrary, type CatalogStore } from './catalog'
import { MobileError } from './errors'
import { checkedResponse, jsonBody, type MobileContext, type MobileOperation } from './http'

export interface EbookStore {
    asset(id: string, signal: AbortSignal): Promise<{ url: string; format: 'pdf' | 'epub' } | null>
    location(textId: string, userId: string): Promise<string | null>
    bookmarks(textId: string, userId: string): Promise<z.infer<typeof ebookBookmarkSchema>[]>
    savePosition(textId: string, userId: string, location: string): Promise<void>
    removeBookmark(input: { textId: string; userId: string; bookmarkId: number }): Promise<void>
    saveBookmark(input: {
        textId: string
        userId: string
        quote: string
        chapter: string | null
        location: string | null
    }): Promise<z.infer<typeof ebookBookmarkSchema>>
}
const positionInput = z.object({ location: z.string().min(1).max(2048) }).strict()
const bookmarkInput = z
    .object({
        quote: z.string().min(1).max(16000),
        chapter: z.string().max(512).nullable(),
        location: z.string().max(2048).nullable(),
    })
    .strict()
const bookmarkRemovalInput = z.object({ bookmarkId: z.number().int().positive() }).strict()

export function createEbookOperations(dependencies: { catalog: CatalogStore; ebooks: EbookStore }) {
    const catalog = createCatalog(dependencies.catalog)
    const store = dependencies.ebooks

    async function authorizedEbook({ subject, params, signal }: MobileContext) {
        const textId = resourceID.parse(params.textId)
        const result = await catalog.authorizedText(subject, textId, signal)
        if (!result.text.has_ebook) throw new MobileError('unsupported_format')
        return { textId, ...result }
    }

    const ebook: MobileOperation = async (context) => {
        const { textId, text, library } = await authorizedEbook(context)
        const { subject, signal } = context
        const [asset, location, bookmarks, archived] = await Promise.all([
            store.asset(textId, signal),
            store.location(textId, subject.userId),
            store.bookmarks(textId, subject.userId),
            dependencies.catalog.archived(subject, signal),
        ])
        if (!asset) throw new MobileError('inaccessible')
        return checkedResponse(ebookSchema, {
            text: summarizeText(text),
            library: summarizeLibrary(library, subject, archived),
            ...asset,
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
            location,
            bookmarks,
        })
    }

    const ebookPosition: MobileOperation = async (context) => {
        const { textId } = await authorizedEbook(context)
        const { location } = positionInput.parse(await jsonBody(context.request, 65536, context.signal))
        await store.savePosition(textId, context.subject.userId, location)
        return { saved: true }
    }

    const ebookBookmark: MobileOperation = async (context) => {
        const { textId } = await authorizedEbook(context)
        const input = bookmarkInput.parse(await jsonBody(context.request, 65536, context.signal))
        return checkedResponse(
            ebookBookmarkSchema,
            await store.saveBookmark({ ...input, textId, userId: context.subject.userId }),
        )
    }

    const removeEbookBookmark: MobileOperation = async (context) => {
        const { textId } = await authorizedEbook(context)
        const { bookmarkId } = bookmarkRemovalInput.parse(await jsonBody(context.request, 65536, context.signal))
        await store.removeBookmark({ textId, userId: context.subject.userId, bookmarkId })
        return { removed: true }
    }

    return { ebook, ebookPosition, ebookBookmark, removeEbookBookmark }
}
