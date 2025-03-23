import 'server-only'
import { getXataClient } from '../client/xata'
import { Plan } from '@/server/auth/quota'
import { clerkClient } from '@clerk/nextjs/server'
import { redis } from '../client/redis'

const xata = getXataClient()

export async function getCustomerId(userId: string) {
    const customer = await xata.db.users.filter({
        id: userId,
    }).getFirstOrThrow()
    return customer.creem_id
}

export async function fillCustomerId({ userId, customerId }: { userId: string, customerId: string }) {
    await xata.db.users.updateOrThrow({
        id: userId,
        creem_id: customerId,
    })
}

export async function getUserIdByCustomerId(customerId: string) {
    const customer = await xata.db.users.filter({
        creem_id: customerId,
    }).getFirstOrThrow()
    return customer.id
}

export async function updateSubscription({ userId, plan }: { userId: string, plan: Plan }) {
    await (await clerkClient()).users.updateUserMetadata(userId, {
        publicMetadata: {
            plan,
        },
    })
}

export async function createRequest(userId: string) {
    const requestId = crypto.randomUUID()
    await redis.set(`creem:request:${requestId}`, userId, {
        ex: 60 * 60 * 24,
    })
    return requestId
}

export async function getRequestUserId(requestId: string) {
    const userId = await redis.get(`creem:request:${requestId}`) as string | null
    if (!userId) {
        throw new Error('Request not found')
    }
    return userId
}

export async function toggleOrgCreationAccess({ userId, enabled }: { userId: string, enabled: boolean }) {
    await (await clerkClient()).users.updateUser(userId, {
        createOrganizationEnabled: enabled,
    })
}
