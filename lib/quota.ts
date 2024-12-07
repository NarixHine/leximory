import { auth } from '@clerk/nextjs/server'
import { redis } from './redis'

const getPlan = async () => (await auth()).sessionClaims?.plan

export const maxCommentaryQuota = async () => {
    const plan = await getPlan()
    if (plan === 'communicator') {
        return 999
    }
    else if (plan === 'interlocutor') {
        return 100
    }
    return 50
}

export const maxAudioQuota = async () => {
    const plan = await getPlan()
    if (plan === 'communicator') {
        return 99
    }
    else if (plan === 'interlocutor') {
        return 10
    }
    return 5
}

export default async function incrCommentaryQuota(incrBy: number = 1) {
    const { userId } = await auth()
    const quotaKey = `user:${userId}:commentary_quota`

    const quota = await redis.incrbyfloat(quotaKey, incrBy)

    if (quota === 1) {
        await redis.expire(quotaKey, 60 * 60 * 24 * 30)
    }

    return quota > await maxCommentaryQuota()
}

export async function getCommentaryQuota() {
    const { userId } = await auth()
    const quotaKey = `user:${userId}:commentary_quota`

    const quota: number = (await redis.get(quotaKey)) ?? 0

    return { quota, max: await maxCommentaryQuota(), percentage: Math.floor(100 * quota / await maxCommentaryQuota()) }
}

export async function incrAudioQuota() {
    const { userId } = await auth()
    const quotaKey = `user:${userId}:audio_quota`

    const quota = await redis.incr(quotaKey)

    if (quota === 1) {
        await redis.expire(quotaKey, 60 * 60 * 24 * 30)
    }

    return quota > await maxAudioQuota()
}

export async function getAudioQuota() {
    const { userId } = await auth()
    const quotaKey = `user:${userId}:audio_quota`

    const quota: number = (await redis.get(quotaKey)) ?? 0

    return { quota, max: await maxAudioQuota(), percentage: Math.floor(100 * quota / await maxAudioQuota()) }
}
