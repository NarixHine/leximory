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
        }
    }

    console.log(`[Streak Debug] User: ${userId} - Raw data count: ${data.length}`)
    const dates = data.map(m => momentSH(m.created_at).startOf('day'))
    const uniqueDates = [...new Set(dates.map(d => d.format('YYYY-MM-DD')))].map(d => momentSH(d))
    console.log(`[Streak Debug] Unique dates:`, uniqueDates.map(d => d.format()))

    if (uniqueDates.length === 0) {
        console.log('[Streak Debug] No unique dates, returning 0.')
        return {
            total: 0,
            history: [],
        }
    }

    let currentStreak = 0
    let lastDate = momentSH().startOf('day').add(1, 'day') // Start from tomorrow
    console.log(`[Streak Debug] Initial lastDate: ${lastDate.format()}`)

    for (const date of uniqueDates) {
        const diff = lastDate.diff(date, 'days')
        console.log(`[Streak Debug] Comparing ${lastDate.format()} to ${date.format()}. Diff: ${diff} days. Current streak: ${currentStreak}`)
        if (diff === 1) {
            currentStreak++
        } else {
            // The first date starts the streak
            if (currentStreak === 0) {
                currentStreak = 1
            } else {
                // A gap was found, so the streak ends
                console.log('[Streak Debug] Gap found, breaking loop.')
                break
            }
        }
        lastDate = date
    }
    
    console.log(`[Streak Debug] Streak after loop: ${currentStreak}`)
    // Check if the streak is active today or yesterday
    const today = momentSH().startOf('day')
    const mostRecentDate = uniqueDates[0]
    console.log(`[Streak Debug] Final check. Today: ${today.format()}. Most recent memory: ${mostRecentDate.format()}`)
    if (today.diff(mostRecentDate, 'days') > 1) {
        console.log(`[Streak Debug] Streak broken. Diff is > 1 day. Resetting to 0.`)
        currentStreak = 0
    }

    const history = Array.from({ length: 8 }).map((_, i) => {
        const date = momentSH().subtract(i, 'days').startOf('day')
        return {
            date: date.format('YYYY-MM-DD'),
            active: uniqueDates.some(d => d.isSame(date, 'day')),
        }
    }).reverse()

    console.log(`[Streak Debug] Final streak for user ${userId}: ${currentStreak}`)
    return {
        total: currentStreak,
        history,
    }
}