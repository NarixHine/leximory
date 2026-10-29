import 'server-only'
import { revalidateTag } from 'next/cache'
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
        revalidateTag('libraries', { expire: 0 })
    },
})
export const createFolder = mobileEndpoint(verify, folders.createFolder)
export const renameFolder = mobileEndpoint(verify, folders.renameFolder)
export const libraryArchive = mobileEndpoint(verify, archive.libraryArchive)
