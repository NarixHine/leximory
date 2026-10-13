import { z } from 'zod'
import { folderCreateSchema, folderRenameSchema, librarySchema } from '@repo/api'
import { canWriteLibrary } from '@repo/service/access'
import type { MobileSubject } from '@repo/schema/mobile'
import { requireMobileSubject, type BearerVerifier } from './auth'
import { createCatalog, summarizeLibrary, type CatalogStore, type LibraryRow } from './catalog'
import { jsonBody } from './definitions'
import { MobileError, mobileErrorResponse } from './errors'

export interface FolderStore {
    create(subject: MobileSubject, input: z.infer<typeof folderCreateSchema>, signal: AbortSignal): Promise<LibraryRow>
    rename(library: LibraryRow, name: string, signal: AbortSignal): Promise<LibraryRow>
}

export function createFolderHandler(dependencies: { verify: BearerVerifier; catalog: CatalogStore; folders: FolderStore }) {
    const catalog = createCatalog(dependencies.catalog)
    return async (request: Request): Promise<Response> => {
        try {
            const subject = await requireMobileSubject(request, dependencies.verify)
            if (request.method !== 'POST') throw new MobileError('inaccessible')
            const signal = AbortSignal.any([request.signal, AbortSignal.timeout(20000)])
            const path = new URL(request.url).pathname
            let library: LibraryRow
            if (path === '/api/mobile/v1/libraries') {
                library = await dependencies.folders.create(subject, folderCreateSchema.parse(await jsonBody(request, 4096)), signal)
            } else {
                const id = /^\/api\/mobile\/v1\/libraries\/([A-Za-z0-9_-]{1,128})\/name$/.exec(path)?.[1]
                if (!id) throw new MobileError('inaccessible')
                const existing = await catalog.authorizedLibrary(subject, id, signal)
                if (!canWriteLibrary(subject, existing) || existing.shadow) throw new MobileError('inaccessible')
                const { name } = folderRenameSchema.parse(await jsonBody(request, 4096))
                library = await dependencies.folders.rename(existing, name, signal)
            }
            const archived = await dependencies.catalog.archived(subject, signal)
            return Response.json(librarySchema.parse(summarizeLibrary(library, subject, archived)), { headers: { 'Cache-Control': 'private, no-store' } })
        } catch (error) {
            return mobileErrorResponse(error instanceof z.ZodError || error instanceof SyntaxError ? new MobileError('invalid_input') : error)
        }
    }
}
