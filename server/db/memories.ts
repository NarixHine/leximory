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

export async function getPersonalMemories({ userId, page, size }: { userId: string, page: number, size: number }) {
    const { data: memories } = await supabase
        .from('memories')
        .select('id, content, created_at, public, streak, creator')
        .eq('creator', userId)
        .order('created_at', { ascending: false })
        .range((page - 1) * size, page * size - 1)
        .throwOnError()

    if (!memories) return []

    const memoriesWithAvatars = await Promise.all(memories.map(async (memory) => {
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

export async function getFederatedMemories({ page, size }: { page: number, size: number }) {
    const { data: memories } = await supabase
        .from('memories')
        .select('id, content, created_at, public, streak, creator')
        .eq('public', true)
        .order('created_at', { ascending: false })
        .range((page - 1) * size, page * size - 1)
        .throwOnError()

    if (!memories) return []

    const memoriesWithAvatars = await Promise.all(memories.map(async (memory) => {
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

    const dates = data.map(m => momentSH(m.created_at).startOf('day'))
    const uniqueDates = [...new Set(dates.map(d => d.format('YYYY-MM-DD')))].map(d => momentSH(d))

    if (uniqueDates.length === 0) {
        return {
            total: 0,
            history: [],
        }
    }

    let currentStreak = 0
    let lastDate = momentSH().startOf('day').add(1, 'day') // Start from tomorrow

    for (const date of uniqueDates) {
        if (lastDate.diff(date, 'days') === 1) {
            currentStreak++
        } else {
            // The first date starts the streak
            if (currentStreak === 0) {
                currentStreak = 1
            } else {
                // A gap was found, so the streak ends
                break
            }
        }
        lastDate = date
    }
    
    // Check if the streak is active today or yesterday
    const today = momentSH().startOf('day')
    if (today.diff(uniqueDates[0], 'days') > 1) {
        currentStreak = 0
    }

    const history = Array.from({ length: 8 }).map((_, i) => {
        const date = momentSH().subtract(i, 'days').startOf('day')
        return {
            date: date.format('YYYY-MM-DD'),
            active: uniqueDates.some(d => d.isSame(date, 'day')),
        }
    }).reverse()

    return {
        total: currentStreak,
        history,
    }
}