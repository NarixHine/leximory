import 'server-only'
import { LIB_ACCESS_STATUS, Lang } from '@repo/env/config'
import { supabase } from '@repo/supabase'
import { ensureUserExists } from '../user'
import { getLanguageName } from '@repo/languages'
import type { Tables, TablesInsert, TablesUpdate } from '../types'
import { randomUUID } from 'crypto'

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

    await ensureUserExists(owner)
    const { data: lib } = await supabase
        .from('libraries')
        .insert({
            owner,
            shadow: true,
            name: `🗃️ ${getLanguageName(lang)}词汇仓库`,
            lang,
        })
        .select()
        .single()

    return lib!
}

/**
 * Retrieves a library record by ID.
 */
export async function getLibraryById({ id }: { id: string }) {
    const { data, error } = await supabase
        .from('libraries')
        .select('id, name, lang, owner, access, price, org, prompt, shadow, starred_by')
        .eq('id', id)
        .single()

    if (error) {
        throw error
    }

    return data as Tables<'libraries'>
}

/**
 * Creates a new library owned by the given user.
 */
export async function createLibraryRecord({
    name,
    lang,
    owner,
    org,
    price = 0,
    prompt,
    access = LIB_ACCESS_STATUS.private,
}: {
    name: string
    lang: Lang
    owner: string
    org?: string | null
    price?: number
    prompt?: string | null
    access?: TablesInsert<'libraries'>['access']
}) {
    const id = randomUUID().replace(/-/g, '')

    const { data, error } = await supabase
        .from('libraries')
        .insert({
            id,
            owner,
            name,
            lang,
            org: org ?? null,
            price,
            prompt,
            access,
        })
        .select('id, name, lang, owner, access, price, org, prompt, shadow')
        .single()

    if (error) {
        throw error
    }

    return data as Tables<'libraries'>
}

/**
 * Updates library metadata.
 */
export async function updateLibraryRecord({
    id,
    data,
}: {
    id: string
    data: TablesUpdate<'libraries'>
}) {
    const { data: library, error } = await supabase
        .from('libraries')
        .update(data)
        .eq('id', id)
        .select('id, name, lang, owner, access, price, org, prompt, shadow, starred_by')
        .single()

    if (error) {
        throw error
    }

    return library as Tables<'libraries'>
}

/**
 * Deletes a library and cascaded resources.
 */
export async function deleteLibraryRecord({ id }: { id: string }) {
    const { error } = await supabase
        .from('libraries')
        .delete()
        .eq('id', id)

    if (error) {
        throw error
    }
}

/**
 * Removes a star from the given library for a user.
 */
export async function unstarLibrary({ libId, userId }: { libId: string, userId: string }) {
    const { data: library, error: fetchError } = await supabase
        .from('libraries')
        .select('starred_by')
        .eq('id', libId)
        .single()

    if (fetchError) {
        throw fetchError
    }

    const updatedStars = (library?.starred_by ?? []).filter(id => id !== userId)

    const { error } = await supabase
        .from('libraries')
        .update({ starred_by: updatedStars })
        .eq('id', libId)

    if (error) {
        throw error
    }
}

/**
 * Fetches archived library IDs for a user, ensuring the user row exists.
 */
export async function getArchivedLibraries({ userId }: { userId: string }) {
    await ensureUserExists(userId)
    const { data, error } = await supabase
        .from('users')
        .select('archived_libs')
        .eq('id', userId)
        .single()

    if (error) {
        throw error
    }

    return data.archived_libs ?? []
}

/**
 * Adds a library to the user's archive list.
 */
export async function addLibraryToArchive({ userId, libId }: { userId: string, libId: string }) {
    const archived = await getArchivedLibraries({ userId })
    const nextArchive = archived.includes(libId) ? archived : [...archived, libId]

    const { error } = await supabase
        .from('users')
        .update({ archived_libs: nextArchive })
        .eq('id', userId)

    if (error) {
        throw error
    }
}

/**
 * Removes a library from the user's archive list.
 */
export async function removeLibraryFromArchive({ userId, libId }: { userId: string, libId: string }) {
    const archived = await getArchivedLibraries({ userId })
    const nextArchive = archived.filter(id => id !== libId)

    const { error } = await supabase
        .from('users')
        .update({ archived_libs: nextArchive })
        .eq('id', userId)

    if (error) {
        throw error
    }
}
