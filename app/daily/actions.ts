'use server'

import { getAuthOrThrow } from '@/server/auth/role'
import saveSubs, { delSubs } from '@/server/db/subs'
import { PushSubscription } from 'web-push'
import { Lang } from '@/lib/config'
import { getShadowLib } from '@/server/db/lib'
import { generateStory } from '../library/[lib]/corpus/actions'

export async function save({ subs, hour }: { subs: PushSubscription, hour: number }) {
    const { userId } = await getAuthOrThrow()
    await saveSubs({ userId, subs, hour })
}

export async function remove() {
    const { userId } = await getAuthOrThrow()
    await delSubs({ userId })
}

export async function genStoryInShadowLib({ comments, lang }: {
    comments: string[]
    lang: Lang
}) {
    const { userId } = await getAuthOrThrow()
    const lib = await getShadowLib({ owner: userId, lang })
    return await generateStory({ comments, lib: lib.id, isShadow: true })
}

