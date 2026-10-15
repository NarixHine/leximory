import { z } from 'zod'
import { folderCreateSchema, folderRenameSchema, librarySchema, resourceID } from '@repo/api'
import { canWriteLibrary } from '@repo/service/access'
import type { MobileSubject } from '@repo/schema/mobile'
import { createCatalog, summarizeLibrary, type CatalogStore, type LibraryRow } from './catalog'
import { checkedResponse, jsonBody, type MobileContext, type MobileOperation } from './http'
import { MobileError } from './errors'

export interface FolderStore {
    create(subject: MobileSubject, input: z.infer<typeof folderCreateSchema>, signal: AbortSignal): Promise<LibraryRow>
    rename(library: LibraryRow, name: string, signal: AbortSignal): Promise<LibraryRow>
}

export function createFolderOperations(dependencies: { catalog: CatalogStore; folders: FolderStore }) {
    const catalog = createCatalog(dependencies.catalog)

    async function result(library: LibraryRow, { subject, signal }: MobileContext) {
        const archived = await dependencies.catalog.archived(subject, signal)
        return checkedResponse(librarySchema, summarizeLibrary(library, subject, archived))
    }

    const createFolder: MobileOperation = async (context) => {
        const input = folderCreateSchema.parse(await jsonBody(context.request, 4096, context.signal))
        const library = await dependencies.folders.create(context.subject, input, context.signal)
        return result(library, context)
    }

    const renameFolder: MobileOperation = async (context) => {
        const library = await catalog.authorizedLibrary(
            context.subject,
            resourceID.parse(context.params.libraryId),
            context.signal,
        )
        if (!canWriteLibrary(context.subject, library) || library.shadow) throw new MobileError('inaccessible')
        const { name } = folderRenameSchema.parse(await jsonBody(context.request, 4096, context.signal))
        return result(await dependencies.folders.rename(library, name, context.signal), context)
    }

    return { createFolder, renameFolder }
}
