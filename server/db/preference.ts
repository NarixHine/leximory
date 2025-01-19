import 'server-only'

import { redis } from '../client/redis'

export type Accent = 'BrE' | 'AmE'

export async function setAccentPreference({ accent, userId }: { accent: Accent, userId: string }) {
    await redis.set(`user:${userId}:english_preference`, accent)
}

export async function getAccentPreference({ userId }: { userId: string }) {
    const accent = await redis.get(`user:${userId}:english_preference`)
    return accent as Accent | undefined ?? 'BrE'
}
