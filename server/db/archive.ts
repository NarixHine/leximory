import 'server-only'

import { getXataClient } from '../client/xata'

const xata = getXataClient()

export async function getArchivedLibs({ userId }: { userId: string }) {
    const archive = await xata.db.users.select(['archived_libs']).filter({ id: userId }).getFirst()
    if (!archive) {
        return []
    }
    return archive.archived_libs ?? []
}

export async function addToArchive({ userId, libId }: { userId: string, libId: string }) {
    const archive = await getArchivedLibs({ userId })
    await xata.db.users.update({ id: userId, archived_libs: [...archive, libId] })
}

export async function removeFromArchive({ userId, libId }: { userId: string, libId: string }) {
    const archive = await getArchivedLibs({ userId })
    await xata.db.users.update({ id: userId, archived_libs: archive.filter((id) => id !== libId) })
}
