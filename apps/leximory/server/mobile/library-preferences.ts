import { z } from 'zod'
import { resourceID } from '@repo/api'
import { createCatalog, type CatalogStore } from './catalog'
import { jsonBody, type MobileOperation } from './http'

const archiveInput = z.object({ archived: z.boolean() }).strict()

export function createLibraryArchiveOperations(dependencies: {
    catalog: CatalogStore
    setArchived: (userId: string, libraryId: string, archived: boolean, signal: AbortSignal) => Promise<void>
}) {
    const catalog = createCatalog(dependencies.catalog)

    const libraryArchive: MobileOperation = async ({ request, subject, params, signal }) => {
        const libraryId = resourceID.parse(params.libraryId)
        await catalog.authorizedLibrary(subject, libraryId, signal)
        const { archived } = archiveInput.parse(await jsonBody(request, 1024, signal))
        await dependencies.setArchived(subject.userId, libraryId, archived, signal)
        return { archived }
    }

    return { libraryArchive }
}
