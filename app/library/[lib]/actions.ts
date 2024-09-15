'use server'

import { authReadToLib } from '@/lib/auth'
import { getXataClient } from '@/lib/xata'
import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'

export default async function star(lib: string) {
    const xata = getXataClient()
    const { userId } = auth()
    const { rec } = await authReadToLib(lib)
    const { starredBy } = rec
    const newStarredBy = starredBy?.includes(userId!)
        ? (starredBy ?? []).filter(x => x !== userId!)
        : [...(starredBy ?? []), userId!]
    await xata.db.libraries.update(lib, { starredBy: newStarredBy })
    revalidatePath(`/library/${lib}`)
}
