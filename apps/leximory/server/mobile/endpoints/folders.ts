import 'server-only'
import { invalidateMutationCaches } from '../mutation-effects'
import { mobileEndpoint } from '../http'
import { verify } from './verify'
import { createFolderOperations } from '../folders'
import { createLibraryArchiveOperations } from '../library-preferences'
import { catalogStore, libraryPreferences } from '../store'
import { folderStore } from '../folder-store'

const folders = createFolderOperations({ catalog: catalogStore, folders: folderStore })
const archive = createLibraryArchiveOperations({
    catalog: catalogStore,
    setArchived: async (...input) => {
        await libraryPreferences.setArchived(...input)
        invalidateMutationCaches('libraries')
    },
})
export const createFolder = mobileEndpoint(verify, folders.createFolder)
export const renameFolder = mobileEndpoint(verify, folders.renameFolder)
export const libraryArchive = mobileEndpoint(verify, archive.libraryArchive)
