import 'server-only'
import { getPlan, getUserOrThrow } from './user'
import { incrementQuota, getQuota } from '../db/quota'
import { isProd } from '@/lib/env'

export const maxCommentaryQuota = async (userId?: string) => {
    const plan = await getPlan(userId)
    switch (plan) {
        case 'leximory':
            return 999
        case 'polyglot':
            return 200
        case 'bilingual':
            return 100
        default:
            return 20
    }
}

export const maxAudioQuota = async () => {
    const plan = await getPlan()
    switch (plan) {
        case 'leximory':
            return 100
        case 'polyglot':
            return 20
        case 'bilingual':
            return 10
        default:
            return 3
    }
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
    return { quota, max, percentage: Math.floor(100 * quota / max) }
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
    return { quota, max, percentage: Math.floor(100 * quota / max) }
}
