import 'server-only'
import { getUserOrThrow } from './user'
import { ADMIN_UID, Lang, libAccessStatusMap } from '../../lib/config'
import { supabase } from '@/server/client/supabase'

// auth admin access
export async function requireAdmin() {
    const user = await getUserOrThrow()
    if (user.userId !== ADMIN_UID) {
        throw new Error('Unauthorized')
    }
}

// auth access to libs

export const authWriteToLib = async (lib: string, explicitUserId?: string) => {
    const { userId } = explicitUserId ? { userId: explicitUserId } : await getUserOrThrow()

    const { data: rec, error } = await supabase
        .from('libraries')
        .select('lang')
        .eq('id', lib)
        .eq('owner', userId)
        .single()

    if (error || !rec) {
        throw new Error('Library not found or access denied')
    }

    return { lang: rec.lang as Lang }
}

export const authReadToLib = async (lib: string) => {
    const { userId } = await getUserOrThrow()

    const { data: rec, error } = await supabase
        .from('libraries')
        .select('owner, lang, name, starred_by, price, access')
        .eq('id', lib)
        .or(`owner.eq.${userId},and(access.eq.${libAccessStatusMap.public},starred_by.cs.{"${userId}"})`)
        .single()

    if (error || !rec) {
        throw new Error('Library not found or access denied')
    }

    const isReadOnly = rec.owner !== userId
    const isOwner = rec.owner === userId
    const { lang } = rec
    return {
        isReadOnly,
        isOwner,
        owner: rec.owner,
        lang: lang as Lang,
        name: rec.name,
        starredBy: rec.starred_by,
        price: rec.price,
        access: rec.access
    }
}

export const authReadToLibWithoutThrowing = async (lib: string) => {
    const { userId } = await getUserOrThrow()

    const { data: rec } = await supabase
        .from('libraries')
        .select('owner, lang, name, starred_by, price, access')
        .eq('id', lib)
        .single()
        .throwOnError()

    const isReadOnly = rec.owner !== userId
    const isOwner = rec.owner === userId
    const { lang } = rec
    return {
        isReadOnly,
        isOwner,
        owner: rec.owner,
        lang: lang as Lang,
        name: rec.name,
        starredBy: rec.starred_by,
        price: rec.price,
        access: rec.access,
        isStarred: Boolean(rec.starred_by?.includes(userId))
    }
}

// auth access to items related to libs

export const authWriteToText = async (text: string) => {
    const { userId } = await getUserOrThrow()

    const { data: rec, error } = await supabase
        .from('texts')
        .select(`
            *,
            lib:libraries!inner (
                id,
                owner,
                access
            )
        `)
        .eq('id', text)
        .eq('lib.owner', userId)
        .single()

    if (error || !rec) {
        throw new Error('Text not found or access denied')
    }

    return rec
}

export const authReadToText = async (text: string) => {
    const { userId } = await getUserOrThrow()

    const { data: rec, error } = await supabase
        .from('texts')
        .select(`
            *,
            lib:libraries!inner (
                id,
                owner,
                access
            )
        `)
        .eq('id', text)
        .or(`owner.eq.${userId},access.eq.${libAccessStatusMap.public}`, { referencedTable: 'libraries' })
        .single()

    if (error || !rec) {
        throw new Error('Text not found or access denied')
    }

    return rec
}

// Filter helpers for building queries

export type OrFilter = Awaited<ReturnType<typeof isListedFilter>>

export const isListedFilter = async () => {
    const { userId } = await getUserOrThrow()
    return {
        filters: `owner.eq.${userId},and(starred_by.cs.{"${userId}"},access.eq.${libAccessStatusMap.public})`,
        options: { referencedTable: 'libraries' }
    }
}
