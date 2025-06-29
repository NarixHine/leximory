import 'server-only'
import { Lang, langMap, libAccessStatusMap, welcomeMap } from '@/lib/config'
import { nanoid } from '@/lib/utils'
import { revalidateTag } from 'next/cache'
import { unstable_cacheTag as cacheTag } from 'next/cache'
import { pick } from 'es-toolkit'
import { supabase } from '@/server/client/supabase'
import { OrFilter } from '../auth/role'
import { getLexicoinBalance } from './lexicoin'

export async function getShadowLib({ owner, lang }: { owner: string, lang: Lang }) {
    const { data: rec } = await supabase
        .from('libraries')
        .select('*')
        .eq('owner', owner)
        .eq('shadow', true)
        .eq('lang', lang)
        .single()

    if (rec) {
        return rec
    }

    const { data: lib } = await supabase
        .from('libraries')
        .insert({
            owner,
            shadow: true,
            name: `🗃️ ${langMap[lang]}词汇仓库`,
            lang,
        })
        .select()
        .single()

    return lib!
}

export async function starLib({ lib, userId }: { lib: string, userId: string }) {
    revalidateTag('libraries')
    const { data: library } = await supabase
        .from('libraries')
        .select('starred_by')
        .eq('id', lib)
        .single()

    const newStarredBy = library?.starred_by?.includes(userId)
        ? (library.starred_by ?? []).filter((x: string) => x !== userId)
        : [...(library?.starred_by ?? []), userId]

    await supabase
        .from('libraries')
        .update({ starred_by: newStarredBy })
        .eq('id', lib)

    return newStarredBy.includes(userId)
}

export async function unstarLib({ lib, userId }: { lib: string, userId: string }) {
    revalidateTag('libraries')
    const { data: library } = await supabase
        .from('libraries')
        .select('starred_by')
        .eq('id', lib)
        .single()

    const newStarredBy = library?.starred_by?.filter((x: string) => x !== userId)
    await supabase
        .from('libraries')
        .update({ starred_by: newStarredBy })
        .eq('id', lib)
}

export async function updateLib({ id, access, name, org, price }: { id: string, access: typeof libAccessStatusMap.public | typeof libAccessStatusMap.private, name: string, org: string | null, price: number }) {
    await supabase
        .from('libraries')
        .update({
            org: org === 'none' ? null : org,
            name,
            access,
            price,
        })
        .eq('id', id)

    revalidateTag('libraries')
    revalidateTag(`lib:${id}`)
}

export async function createLib({ name, lang, owner }: { name: string, lang: Lang, owner: string }) {
    const id = nanoid()

    await supabase.from('libraries').insert({
        id,
        owner,
        name,
        lang,
        access: libAccessStatusMap.private,
    })

    await supabase.from('lexicon').insert({
        lib: id,
        word: welcomeMap[lang],
    })

    revalidateTag('libraries')
    return id
}

export async function deleteLib({ id }: { id: string }) {
    const { data: texts } = await supabase
        .from('texts')
        .select('id')
        .eq('lib', id)
        .throwOnError()

    const { data: words } = await supabase
        .from('lexicon')
        .select('id')
        .eq('lib', id)
        .throwOnError()

    await Promise.all([
        supabase.from('libraries').delete().eq('id', id),
        supabase.from('texts').delete().in('id', texts.map(({ id }) => id)),
        supabase.from('lexicon').delete().in('id', words.map(({ id }) => id))
    ])

    revalidateTag('libraries')
}

export async function countPublicLibs() {
    'use cache'
    cacheTag('libraries')
    const { count } = await supabase
        .from('libraries')
        .select('*', { count: 'exact', head: true })
        .eq('access', libAccessStatusMap.public)
    return count ?? 0
}

export async function getPaginatedPublicLibs({ page, size }: { page: number, size: number }) {
    'use cache'
    cacheTag('libraries')
    const { data } = await supabase
        .from('libraries')
        .select('id, name, lang, owner, starred_by, price')
        .eq('access', libAccessStatusMap.public)
        .order('created_at', { ascending: false })
        .range((page - 1) * size, page * size - 1)
        .throwOnError()

    return data.map(({ id, name, lang, owner, starred_by, price }) => ({
        id,
        name,
        lang: lang as Lang,
        owner,
        starredBy: starred_by,
        price
    })) ?? []
}

export async function getLib({ id }: { id: string }) {
    const { data } = await supabase
        .from('libraries')
        .select('id, name, lang, org, access, owner, starred_by')
        .eq('id', id)
        .single()
        .throwOnError()
    return data
}

export async function listShortcutLibs({ owner }: { owner: string }) {
    'use cache'
    cacheTag('libraries')
    const { data } = await supabase
        .from('libraries')
        .select('id, name')
        .eq('owner', owner)
        .throwOnError()
    return data.map(({ id, name }) => ({ id, name })) ?? []
}

export async function listLibs({ owner }: { owner: string }) {
    'use cache'
    cacheTag('libraries')
    const query = supabase
        .from('libraries')
        .select('id')
        .eq('owner', owner)

    const { data } = await query.throwOnError()
    return data.map(({ id }) => id) ?? []
}

export async function listLibsWithFullInfo({ or: { filters }, userId }: { or: OrFilter, userId?: string }) {
    'use cache'
    cacheTag('libraries')

    const { data } = await supabase
        .from('libraries')
        .select('id, name, lang, owner, price, shadow, access, org, starred_by')
        .or(filters)
        .throwOnError()

    return data.map(lib => ({
        lib: pick(lib, ['id', 'name', 'lang', 'owner', 'price', 'shadow', 'access', 'org']),
        isStarred: userId && lib.starred_by ? lib.starred_by.includes(userId) : false
    }))
}

export async function getArchivedLibs({ userId }: { userId: string }) {
    'use cache'
    cacheTag('libraries')
    await getLexicoinBalance(userId)
    const { data } = await supabase
        .from('users')
        .select('archived_libs')
        .eq('id', userId)
        .single()
        .throwOnError()

    return data.archived_libs ?? []
}

export async function addToArchive({ userId, libId }: { userId: string, libId: string }) {
    revalidateTag('libraries')
    const archive = await getArchivedLibs({ userId })
    await supabase
        .from('users')
        .update({ archived_libs: [...archive, libId] })
        .eq('id', userId)
}

export async function removeFromArchive({ userId, libId }: { userId: string, libId: string }) {
    revalidateTag('libraries')
    const archive = await getArchivedLibs({ userId })
    await supabase
        .from('users')
        .update({ archived_libs: archive.filter((id) => id !== libId) })
        .eq('id', userId)
}

export async function getAllTextsInLib({ libId }: { libId: string }) {
    'use cache'
    cacheTag(`lib:${libId}`)
    const { data } = await supabase
        .from('texts')
        .select(`
            id,
            title,
            content,
            topics,
            has_ebook,
            created_at,
            lib:libraries (
                name, id
            )
        `)
        .eq('lib', libId)
        .throwOnError()

    return data.map(({ id, title, content, topics, has_ebook, created_at, lib }) => ({
        id,
        title,
        content,
        topics: topics ?? [],
        hasEbook: has_ebook,
        createdAt: new Date(created_at!).toDateString(),
        libName: lib?.name ?? 'Unknown Library',
    })) ?? []
}
