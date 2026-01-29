import 'server-only'
import { revalidateTag, updateTag } from 'next/cache'
import { PLAN_COMMENTARY_QUOTA, PLAN_AUDIO_QUOTA } from '@repo/env/config'
import { incrementQuota, getQuota, getQuotaTTL } from '@repo/kv'
import { getPlan, getUserOrThrow } from '.'

export const maxCommentaryQuota = async (userId?: string) => {
    const plan = await getPlan(userId)
    return PLAN_COMMENTARY_QUOTA[plan]
}

export const maxAudioQuota = async () => {
    const plan = await getPlan()
    return PLAN_AUDIO_QUOTA[plan]
}

export default async function incrCommentaryQuota(incrBy: number = 1, explicitUserId?: string, delayRevalidate: boolean = false) {
    const userId = explicitUserId ?? (await getUserOrThrow()).userId
    const quota = await incrementQuota(userId, 'commentary', incrBy)
    if (delayRevalidate)
        revalidateTag(`quota:${userId}:commentary`, 'max')
    else
        updateTag(`quota:${userId}:commentary`)
    return quota > await maxCommentaryQuota(explicitUserId)
}

export { incrCommentaryQuota }

export async function getCommentaryQuota() {
    const { userId } = await getUserOrThrow()
    const quota = await getQuota(userId, 'commentary')
    const max = await maxCommentaryQuota()
    const ttl = await getQuotaTTL(userId, 'commentary')
    return { quota, max, percentage: Math.floor(100 * quota / max), ttl }
}

export async function incrAudioQuota() {
    const { userId } = await getUserOrThrow()
    const quota = await incrementQuota(userId, 'audio')
    updateTag(`quota:${userId}:audio`)
    return quota > await maxAudioQuota()
}

export async function getAudioQuota() {
    const { userId } = await getUserOrThrow()
    const quota = await getQuota(userId, 'audio')
    const max = await maxAudioQuota()
    const ttl = await getQuotaTTL(userId, 'audio')
    return { quota, max, percentage: Math.floor(100 * quota / max), ttl }
}
