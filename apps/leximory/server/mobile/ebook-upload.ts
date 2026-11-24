import { MAX_FILE_SIZE, MOBILE_EBOOK_MAX_BYTES } from '@repo/env/content'
import { ebookUploadGrantInputSchema, ebookUploadGrantSchema } from '@repo/api'
import { z } from 'zod'
import type { EbookReplacement } from './ebook-publication'
import { createCatalog, type CatalogStore } from './catalog'
import { MobileError } from './errors'
import {
    bodyBytes,
    checkedResponse,
    jsonBody,
    type MobileContext,
    type MobileOperation,
    type MobileRequestContext,
} from './http'

export type EbookGrantInput = z.infer<typeof ebookUploadGrantInputSchema>
export type EbookUploadTarget =
    | { kind: 'import'; targetId: string; title: string; requestId: string }
    | { kind: 'replace'; targetId: string }
export type EbookStaging = {
    prepare(context: MobileContext, input: EbookGrantInput): Promise<z.infer<typeof ebookUploadGrantSchema>>
    read(
        context: MobileContext,
        id: string,
        filename: string,
        target: EbookUploadTarget,
    ): Promise<{ upload: EbookUpload; replacement?: EbookReplacement }>
}

export function ebookFormat(filename: string) {
    const extension = filename.split('.').at(-1)?.toLowerCase()
    if (!filename.includes('.') || (extension !== 'epub' && extension !== 'pdf'))
        throw new MobileError('unsupported_format')
    return { extension, mime: extension === 'pdf' ? 'application/pdf' : 'application/epub+zip' } as const
}

export function ebookUploadFromBytes(filename: string, bytes: Uint8Array<ArrayBuffer>) {
    const { extension, mime } = ebookFormat(filename)
    const valid =
        extension === 'pdf'
            ? new TextDecoder().decode(bytes.subarray(0, 5)) === '%PDF-'
            : bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 3 && bytes[3] === 4
    if (!valid) throw new MobileError('unsupported_format')
    return { extension, file: new File([bytes], filename, { type: mime }) }
}

export async function readEbookUpload({ request, signal }: MobileRequestContext, filename: string) {
    ebookFormat(filename)
    return ebookUploadFromBytes(filename, await bodyBytes(request, MAX_FILE_SIZE, signal))
}

export type EbookUpload = ReturnType<typeof ebookUploadFromBytes>

export function createEbookUploadOperations(dependencies: { catalog: CatalogStore; staging: EbookStaging }) {
    const catalog = createCatalog(dependencies.catalog)
    const prepareEbookUpload: MobileOperation = async (context) => {
        const { request, subject, signal } = context
        const input = ebookUploadGrantInputSchema.parse(await jsonBody(request, 8192, signal))
        if (input.size > MOBILE_EBOOK_MAX_BYTES) throw new MobileError('ebook_file_too_large')
        if (input.size <= MAX_FILE_SIZE) throw new MobileError('invalid_input')
        ebookFormat(input.filename)
        if (input.kind === 'import') {
            if (!input.title || input.requestedAt !== undefined) throw new MobileError('invalid_input')
            await catalog.authorizedContentLibrary(subject, input.targetId, signal)
        } else {
            if (input.title !== undefined || input.requestedAt === undefined) throw new MobileError('invalid_input')
            const { text } = await catalog.authorizedContentText(subject, input.targetId, signal)
            if (text.bookmark_url || !text.has_ebook) throw new MobileError('inaccessible')
        }
        return checkedResponse(ebookUploadGrantSchema, await dependencies.staging.prepare(context, input))
    }
    return { prepareEbookUpload }
}
