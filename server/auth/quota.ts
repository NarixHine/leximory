import 'server-only'
import { getPlan, getUserOrThrow } from './user'
import { incrementQuota, getQuota, getQuotaTTL } from '../db/quota'
import { isProd } from '@/lib/env'
import { audioQuotaMap, commentaryQuotaMap } from '@/lib/config'

export const maxCommentaryQuota = async (userId?: string) => {
    const plan = await getPlan(userId)
    return commentaryQuotaMap[plan]
}

export const maxAudioQuota = async () => {
    const plan = await getPlan()
    return audioQuotaMap[plan]
}

export default async function incrCommentaryQuota(incrBy: number = 1, explicitUserId?: string) {
    const userId = explicitUserId ?? (await getUserOrThrow()).userId
    const quota = await incrementQuota(userId, 'commentary', incrBy)
    return isProd && quota > await maxCommentaryQuota(explicitUserId)
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
    return isProd && quota > await maxAudioQuota()
}

export async function getAudioQuota() {
    const { userId } = await getUserOrThrow()
    const quota = await getQuota(userId, 'audio')
    const max = await maxAudioQuota()
    const ttl = await getQuotaTTL(userId, 'audio')
    return { quota, max, percentage: Math.floor(100 * quota / max), ttl }
}
