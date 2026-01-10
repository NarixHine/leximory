import 'server-only'
import { getPlan, getUserOrThrow } from './user'
import { incrementQuota, getQuota, getQuotaTTL } from '../db/quota'
import { PLAN_AUDIO_QUOTA, PLAN_COMMENTARY_QUOTA } from '@/lib/config'
import { revalidateTag, updateTag } from 'next/cache'

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
