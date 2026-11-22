import { MAX_FILE_SIZE } from '@repo/env/content'
import { MobileError } from './errors'
import { bodyBytes, type MobileRequestContext } from './http'

export async function readEbookUpload({ request, signal }: MobileRequestContext, filename: string) {
    const extension = filename.split('.').at(-1)?.toLowerCase()
    if (extension !== 'epub' && extension !== 'pdf') throw new MobileError('unsupported_format')
    const bytes = await bodyBytes(request, MAX_FILE_SIZE, signal)
    const valid =
        extension === 'pdf'
            ? new TextDecoder().decode(bytes.subarray(0, 5)) === '%PDF-'
            : bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 3 && bytes[3] === 4
    if (!valid) throw new MobileError('unsupported_format')
    return {
        extension,
        file: new File([bytes], filename, {
            type: extension === 'pdf' ? 'application/pdf' : 'application/epub+zip',
        }),
    } as const
}

export type EbookUpload = Awaited<ReturnType<typeof readEbookUpload>>
