import 'server-only'

import { unstable_cacheTag as cacheTag } from 'next/cache'
import { getXataClient } from '../client/xata'
import { revalidateTag } from 'next/cache'

const xata = getXataClient()

export type Accent = 'BrE' | 'AmE'

export async function setAccentPreference({ accent, userId }: { accent: Accent, userId: string }) {
    await xata.db.users.update({ id: userId, accent: accent })
    revalidateTag('accent')
}

export async function getAccentPreference({ userId }: { userId: string }) {
    'use cache'
    cacheTag('accent')
    let user = await xata.db.users.select(['accent']).filter({ id: userId }).getFirst()
    if (!user) {
        user = await xata.db.users.create({ id: userId }).catch(() => xata.db.users.select(['accent']).filter({ id: userId }).getFirstOrThrow())
    }
    return user?.accent as Accent
}
