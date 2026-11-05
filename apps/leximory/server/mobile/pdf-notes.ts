import { z } from 'zod'
import { pdfPageDrawingSchema, pdfPageSaveSchema, pdfVersionSchema, resourceID } from '@repo/api'
import { createCatalog, type CatalogStore } from './catalog'
import { checkedResponse, jsonBody, query, type MobileOperation } from './http'
import { MobileError } from './errors'

export type PDFPageDrawing = z.infer<typeof pdfPageDrawingSchema>
export type PDFPageSave = z.infer<typeof pdfPageSaveSchema>
export type PDFNoteScope = { userId: string; textId: string; pdfVersion: string }
export interface PDFNotesStore {
    next(scope: PDFNoteScope, after: number, signal: AbortSignal): Promise<PDFPageDrawing | null>
    save(scope: PDFNoteScope, input: PDFPageSave, signal: AbortSignal): Promise<PDFPageDrawing | null>
}

export function createPDFNotesOperations(dependencies: { catalog: CatalogStore; notes: PDFNotesStore }) {
    const catalog = createCatalog(dependencies.catalog)
    async function authorize(
        subject: Parameters<typeof catalog.authorizedText>[0],
        textId: string,
        signal: AbortSignal,
    ) {
        const { text } = await catalog.authorizedText(subject, textId, signal)
        if (!text.has_ebook) throw new MobileError('unsupported_format')
    }
    const pdfNotes: MobileOperation = async ({ subject, params, request, signal }) => {
        const textId = resourceID.parse(params.textId)
        await authorize(subject, textId, signal)
        const input = z
            .object({
                pdfVersion: pdfVersionSchema,
                after: z.coerce.number().int().min(-1).max(99999).default(-1),
            })
            .parse(query(request, ['pdfVersion', 'after']))
        const note = await dependencies.notes.next(
            { userId: subject.userId, textId, pdfVersion: input.pdfVersion },
            input.after,
            signal,
        )
        // One drawing per response bounds payload size even for heavily annotated books.
        return { notes: note ? [checkedResponse(pdfPageDrawingSchema, note)] : [], nextCursor: note?.pageIndex ?? null }
    }
    const savePDFNote: MobileOperation = async ({ subject, params, request, signal }) => {
        const textId = resourceID.parse(params.textId)
        await authorize(subject, textId, signal)
        const input = pdfPageSaveSchema.parse(await jsonBody(request, 2_800_000, signal))
        if (input.revision === input.baseRevision) throw new MobileError('invalid_input')
        const bytes = Buffer.from(input.drawingBase64, 'base64')
        if (bytes.length > 2 * 1024 * 1024 || bytes.toString('base64') !== input.drawingBase64)
            throw new MobileError('invalid_input')
        const saved = await dependencies.notes.save(
            { userId: subject.userId, textId, pdfVersion: input.pdfVersion },
            input,
            signal,
        )
        if (!saved) throw new MobileError('stale_revision')
        return checkedResponse(pdfPageDrawingSchema, saved)
    }
    return { pdfNotes, savePDFNote }
}
