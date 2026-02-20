'use server'

import { getUserOrThrow } from '@repo/user'
import saveSubs, { delSubs } from '@/server/db/subs'
import { PushSubscription } from 'web-push'
import { Lang } from '@repo/env/config'
import { getShadowLib } from '@/server/db/lib'
import { generateCorpusStory } from '@/service/corpus'

export async function save({ subs, hour }: { subs: PushSubscription, hour: number }) {
    const { userId } = await getUserOrThrow()
    await saveSubs({ userId, subs, hour })
}

export async function remove() {
    const { userId } = await getUserOrThrow()
    await delSubs({ userId })
}

export async function genStoryInShadowLib({ comments, lang }: {
    comments: string[]
    lang: Lang
}) {
    const { userId } = await getUserOrThrow()
    const lib = await getShadowLib({ owner: userId, lang })
    return await generateCorpusStory({ comments, lib: lib.id, isShadow: true })
}

