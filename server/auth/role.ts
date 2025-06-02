import { supabase } from '@/server/client/supabase'
import { auth } from '@clerk/nextjs/server'
import { Lang, libAccessStatusMap } from '../../lib/config'
import { redirect } from 'next/navigation'

export const getAuthOrThrow = async () => {
    const { userId, orgId, orgRole } = await auth()
    if (!userId) {
        redirect('/sign-in')
    }
    return { userId, orgId, orgRole }
}

// auth access to libs

export const authWriteToLib = async (lib: string, explicitUserId?: string) => {
    const { userId, orgId, orgRole } = explicitUserId ? { userId: explicitUserId, orgId: undefined, orgRole: undefined } : await getAuthOrThrow()

    const { data: rec, error } = await supabase
        .from('libraries')
        .select('lang')
        .eq('id', lib)
        .or(`owner.eq.${userId}${orgId && orgRole === 'org:admin' ? `,org.eq.${orgId}` : ''}`)
        .single()

    if (error || !rec) {
        throw new Error('Library not found or access denied')
    }

    return { lang: rec.lang as Lang }
}

export const authReadToLib = async (lib: string) => {
    const { userId, orgId, orgRole } = await getAuthOrThrow()

    const { data: rec, error } = await supabase
        .from('libraries')
        .select('owner, lang, name, starred_by, org, price')
        .eq('id', lib)
        .or(`owner.eq.${userId}${orgId ? `,org.eq.${orgId}` : ''},access.eq.${libAccessStatusMap.public}`)
        .single()

    if (error || !rec) {
        throw new Error('Library not found or access denied')
    }

    const isReadOnly = rec.owner !== (await auth()).userId && (!orgId || orgId !== rec.org || orgRole !== 'org:admin')
    const isOwner = rec.owner === (await auth()).userId
    const { lang } = rec
    const isOrganizational = !!orgId && rec.org === orgId
    return {
        isReadOnly,
        isOwner,
        owner: rec.owner,
        lang: lang as Lang,
        isOrganizational,
        name: rec.name,
        starredBy: rec.starred_by,
        price: rec.price
    }
}

// auth access to items related to libs

export const authWriteToText = async (text: string) => {
    const { userId, orgId, orgRole } = await getAuthOrThrow()

    const { data: rec, error } = await supabase
        .from('texts')
        .select(`
            *,
            lib:libraries!inner (
                id,
                owner,
                org,
                access
            )
        `)
        .eq('id', text)
        .or(`owner.eq.${userId}${orgId && orgRole === 'org:admin' ? `,org.eq.${orgId}` : ''}`, { referencedTable: 'libraries' })
        .single()

    if (error || !rec) {
        throw new Error('Text not found or access denied')
    }

    return rec
}

export const authReadToText = async (text: string) => {
    const { userId, orgId } = await getAuthOrThrow()

    const { data: rec, error } = await supabase
        .from('texts')
        .select(`
            *,
            lib:libraries!inner (
                id,
                owner,
                org,
                access
            )
        `)
        .eq('id', text)
        .or(`owner.eq.${userId},access.eq.${libAccessStatusMap.public}${orgId ? `,org.eq.${orgId}` : ''}`, { referencedTable: 'libraries' })
        .single()

    if (error || !rec) {
        throw new Error('Text not found or access denied')
    }

    return rec
}

// Filter helpers for building queries

export const isPublicFilter = () => `access.eq.${libAccessStatusMap.public}`

export const isStarredByUserFilter = async () => {
    const { userId } = await getAuthOrThrow()
    return `starred_by.cs.{${userId}}`
}

export const isOwnedByUserFilter = async () => {
    const { userId } = await getAuthOrThrow()
    return `owner.eq.${userId}`
}

export const isAccessibleToUserOnlyFilter = async () => {
    const { userId } = await getAuthOrThrow()
    return `or(owner.eq.${userId},and(starred_by.cs.{${userId}},access.eq.${libAccessStatusMap.public}))`
}

export const isAccessibleToUserOrgFilter = async () => {
    const { orgId } = await getAuthOrThrow()
    return `org.eq.${orgId}`
}

export const isListedFilter = async () => {
    const { userId, orgId } = await getAuthOrThrow()
    if (orgId) {
        return [`org.eq.${orgId}`, { referencedTable: 'libraries' }]
    }
    return [`owner.eq.${userId},access.eq.${libAccessStatusMap.public}`, { referencedTable: 'libraries' }]
}
