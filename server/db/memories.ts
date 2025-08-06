import 'server-only'
import { supabase } from '../client/supabase'
import { momentSH } from '@/lib/moment'
import { revalidateTag } from 'next/cache'
import { unstable_cacheTag as cacheTag } from 'next/cache'

export async function createMemory({ content, creator, isPublic, isStreak }: { content: string, creator: string, isPublic: boolean, isStreak: boolean }) {
    await supabase
        .from('memories')
        .insert({
            content,
            creator,
            public: isPublic,
            streak: isStreak,
        })
        .throwOnError()

    revalidateTag(`memories:${creator}`)
    revalidateTag('memories:federated')
}

export async function deleteMemory({ id, creator }: { id: number, creator: string }) {
    await supabase
        .from('memories')
        .delete()
        .eq('id', id)
        .eq('creator', creator)
        .throwOnError()

    revalidateTag(`memories:${creator}`)
    revalidateTag('memories:federated')
}

async function getMemories(queryBuilder: any, page: number, size: number) {
    const { data: memories } = await queryBuilder
        .order('created_at', { ascending: false })
        .range((page - 1) * size, page * size - 1)
        .throwOnError()

    if (!memories) return []

    const memoriesWithAvatars = await Promise.all(memories.map(async (memory: any) => {
        const { data: { user } } = await supabase.auth.admin.getUserById(memory.creator)
        return {
            ...memory,
            creator: {
                id: user?.id ?? '',
                username: user?.user_metadata.username ?? '',
                avatar_url: user?.user_metadata.avatar_url ?? ''
            }
        }
    }))

    return memoriesWithAvatars
}

export function getPersonalMemories({ userId, page, size }: { userId: string, page: number, size: number }) {
    const query = supabase
        .from('memories')
        .select('id, content, created_at, public, streak, creator')
        .eq('creator', userId)
    return getMemories(query, page, size)
}

export function getFederatedMemories({ page, size }: { page: number, size: number }) {
    const query = supabase
        .from('memories')
        .select('id, content, created_at, public, streak, creator')
        .eq('public', true)
    return getMemories(query, page, size)
}

export function getPublicMemories({ userId, page, size }: { userId: string, page: number, size: number }) {
    const query = supabase
        .from('memories')
        .select('id, content, created_at, public, streak, creator')
        .eq('creator', userId)
        .eq('public', true)
    return getMemories(query, page, size)
}

export async function calculateStreak(userId: string) {
    'use cache'
    cacheTag(`memories:${userId}`)

    const { data } = await supabase
        .from('memories')
        .select('created_at')
        .eq('creator', userId)
        .eq('streak', true)
        .order('created_at', { ascending: false })

    if (!data || data.length === 0) {
        return {
            total: 0,
            history: [],
            highest: 0,
        }
    }

    const dates = data.map(m => momentSH(m.created_at).startOf('day'))
    const uniqueDates = [...new Set(dates.map(d => d.format('YYYY-MM-DD')))]
        .map(d => momentSH(d).startOf('day'))

    const history = Array.from({ length: 8 }).map((_, i) => {
        const date = momentSH().subtract(i, 'days').startOf('day')
        return {
            date: date.format('YYYY-MM-DD'),
            active: uniqueDates.some(d => d.isSame(date, 'day')),
        }
    }).reverse()

    if (uniqueDates.length === 0) {
        return { total: 0, history, highest: 0 }
    }

    // Calculate highest streak ever
    let highestStreak = 0
    let tempStreak = 0
    if (uniqueDates.length > 0) {
        highestStreak = 1
        tempStreak = 1
        let lastStreakDate = uniqueDates[0]
        for (let i = 1; i < uniqueDates.length; i++) {
            const currentStreakDate = uniqueDates[i]
            if (lastStreakDate.diff(currentStreakDate, 'days') === 1) {
                tempStreak++
            } else {
                tempStreak = 1
            }
            if (tempStreak > highestStreak) {
                highestStreak = tempStreak
            }
            lastStreakDate = currentStreakDate
        }
    }

    // Calculate current streak
    const today = momentSH().startOf('day')
    const mostRecentDate = uniqueDates[0]
    if (today.diff(mostRecentDate, 'days') > 1) {
        return { total: 0, history, highest: highestStreak }
    }

    let currentStreak = 1
    let lastDate = mostRecentDate
    for (let i = 1; i < uniqueDates.length; i++) {
        const currentDate = uniqueDates[i]
        if (lastDate.diff(currentDate, 'days') === 1) {
            currentStreak++
            lastDate = currentDate
        } else {
            break
        }
    }

    return {
        total: currentStreak,
        history,
        highest: highestStreak,
    }
}