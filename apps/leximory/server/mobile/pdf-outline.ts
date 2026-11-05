import { z } from 'zod'
import { pdfOutlineGenerationSchema, pdfOutlineSaveSchema, pdfOutlineResultSchema, resourceID } from '@repo/api'
import { canWriteLibrary } from '@repo/service/access'
import { createCatalog, type CatalogStore } from './catalog'
import type { EbookStore } from './ebooks'
import { checkedResponse, jsonBody, type MobileContext, type MobileOperation } from './http'
import { MobileError } from './errors'

export type OutlineResult = z.infer<typeof pdfOutlineResultSchema>
// Gemini rejects the bounded array in the API schema. Enforce its limits after generation.
export const pdfOutlineModelSchema = pdfOutlineResultSchema.extend({
    entries: z.array(pdfOutlineResultSchema.shape.entries.element),
})
export type OutlineScope = { userId: string; textId: string; sourceVersion: string }
export interface PDFOutlineStore {
    generate(
        scope: OutlineScope,
        input: z.infer<typeof pdfOutlineGenerationSchema>,
        signal: AbortSignal,
    ): Promise<OutlineResult>
    save(
        scope: OutlineScope,
        input: z.infer<typeof pdfOutlineSaveSchema>,
        signal: AbortSignal,
    ): Promise<{ revision: string; url: string }>
}
export function validatePDFOutline(result: unknown, pageCount: number): OutlineResult {
    const outline = checkedResponse(pdfOutlineResultSchema, result)
    let page = 1,
        depth = -1
    for (const entry of outline.entries) {
        if (entry.page > pageCount || entry.page < page || entry.depth > depth + 1)
            throw new MobileError('service_unavailable')
        page = entry.page
        depth = entry.depth
    }
    return outline
}
export function createPDFOutlineOperations(dependencies: {
    catalog: CatalogStore
    ebooks: EbookStore
    outlines: PDFOutlineStore
}) {
    const catalog = createCatalog(dependencies.catalog)
    async function scope(context: MobileContext, version: string): Promise<OutlineScope> {
        const textId = resourceID.parse(context.params.textId)
        const { text, library } = await catalog.authorizedText(context.subject, textId, context.signal)
        if (!canWriteLibrary(context.subject, library) || library.shadow) throw new MobileError('inaccessible')
        if (!text.has_ebook) throw new MobileError('unsupported_format')
        const asset = await dependencies.ebooks.asset(textId, context.signal)
        if (!asset || asset.format !== 'pdf') throw new MobileError('unsupported_format')
        if (asset.sourceVersion !== version) throw new MobileError('stale_revision')
        return { userId: context.subject.userId, textId, sourceVersion: version }
    }
    const generatePDFOutline: MobileOperation = async (context) => {
        const input = pdfOutlineGenerationSchema.parse(await jsonBody(context.request, 2_000_000, context.signal))
        const authorized = await scope(context, input.sourceVersion)
        if (!input.pages.some((page) => page.trim())) throw new MobileError('unsupported_format')
        return validatePDFOutline(
            await dependencies.outlines.generate(authorized, input, context.signal),
            input.pages.length,
        )
    }
    const savePDFOutline: MobileOperation = async (context) => {
        const input = pdfOutlineSaveSchema.parse(await jsonBody(context.request, 4096, context.signal))
        const authorized = await scope(context, input.sourceVersion)
        return dependencies.outlines.save(authorized, input, context.signal)
    }
    return { generatePDFOutline, savePDFOutline }
}
