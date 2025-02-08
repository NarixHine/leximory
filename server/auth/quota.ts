import { auth, clerkClient } from '@clerk/nextjs/server'
import { incrementQuota, getQuota } from '../db/quota'
import { getAuthOrThrow } from './role'

const getPlan = async (userId?: string) => {
    return userId ? (await (await clerkClient()).users.getUser(userId)).publicMetadata.plan : (await auth()).sessionClaims?.plan
}

export const maxCommentaryQuota = async (userId?: string) => {
    const plan = userId ? await getPlan(userId) : await getPlan()
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

export default async function incrCommentaryQuota(incrBy: number = 1, explicitUserId?: string) {
    const userId = explicitUserId ?? (await getAuthOrThrow()).userId
    const quota = await incrementQuota(userId, 'commentary', incrBy)
    return quota > await maxCommentaryQuota(explicitUserId)
}

export async function getCommentaryQuota() {
    const { userId } = await getAuthOrThrow()
    const quota = await getQuota(userId, 'commentary')
    const max = await maxCommentaryQuota()
    return { quota, max, percentage: Math.floor(100 * quota / max) }
}

export async function incrAudioQuota() {
    const { userId } = await getAuthOrThrow()
    const quota = await incrementQuota(userId, 'audio')
    return quota > await maxAudioQuota()
}


export async function getAudioQuota() {
    const { userId } = await getAuthOrThrow()
    const quota = await getQuota(userId, 'audio')
    const max = await maxAudioQuota()
    return { quota, max, percentage: Math.floor(100 * quota / max) }
}
