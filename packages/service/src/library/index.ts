'use server'

import { actionClient } from '@repo/service'
import { z } from '@repo/schema'
import { Kilpi } from '../kilpi'
import { getUserOrThrow } from '@repo/user'
import { SUPPORTED_LANGS, LIB_ACCESS_STATUS } from '@repo/env/config'
import {
    addLibraryToArchive,
    createLibraryRecord,
    deleteLibraryRecord,
    getLibraryById,
    removeLibraryFromArchive,
    unstarLibrary,
    updateLibraryRecord,
} from '@repo/supabase/library'
import { revalidateTag } from 'next/cache'

const saveSchema = z.object({
    id: z.string(),
    name: z.string(),
    access: z.boolean(),
    org: z.string().optional(),
    price: z.coerce.number().nonnegative().max(100),
    prompt: z.string().optional().nullable(),
})

const createSchema = z.object({
    name: z.string(),
    lang: z.enum(SUPPORTED_LANGS),
})

const idSchema = z.object({
    id: z.string(),
})

/**
 * Updates library metadata after verifying ownership.
 */
export const updateLibraryAction = actionClient
    .inputSchema(saveSchema)
    .action(async ({ parsedInput: { id, name, access, org, price, prompt } }) => {
        const library = await getLibraryById({ id })

        await Kilpi.libraries.write(library).authorize().assert()

        const updated = await updateLibraryRecord({
            id,
            data: {
                name,
                access: access ? LIB_ACCESS_STATUS.public : LIB_ACCESS_STATUS.private,
                org: org ?? null,
                price,
                prompt,
            }
        })

        revalidateTag('libraries', 'max')

        return {
            id: updated.id,
            name: updated.name,
            access: updated.access === LIB_ACCESS_STATUS.public,
            org: updated.org,
            price: updated.price,
            prompt: updated.prompt,
        }
    })

/**
 * Creates a new library for the authenticated user.
 */
export const createLibraryAction = actionClient
    .inputSchema(createSchema)
    .action(async ({ parsedInput: { name, lang } }) => {
        const { userId } = await getUserOrThrow()
        await Kilpi.authed().authorize().assert()

        const library = await createLibraryRecord({
            name,
            lang,
            owner: userId,
        })

        revalidateTag('libraries', 'max')

        return {
            id: library.id,
        }
    })

/**
 * Deletes a library after enforcing ownership.
 */
export const deleteLibraryAction = actionClient
    .inputSchema(idSchema)
    .action(async ({ parsedInput: { id } }) => {
        const library = await getLibraryById({ id })

        await Kilpi.libraries.write(library).authorize().assert()

        await deleteLibraryRecord({ id })
        revalidateTag('libraries', 'max')
    })

/**
 * Archives a library for the current user.
 */
export const archiveLibraryAction = actionClient
    .inputSchema(idSchema)
    .action(async ({ parsedInput: { id } }) => {
        const { userId } = await getUserOrThrow()
        await Kilpi.authed().authorize().assert()

        await addLibraryToArchive({ userId, libId: id })
        revalidateTag('libraries', 'max')
    })

/**
 * Removes a library from the user's archive.
 */
export const unarchiveLibraryAction = actionClient
    .inputSchema(idSchema)
    .action(async ({ parsedInput: { id } }) => {
        const { userId } = await getUserOrThrow()
        await Kilpi.authed().authorize().assert()

        await removeLibraryFromArchive({ userId, libId: id })
        revalidateTag('libraries', 'max')
    })

/**
 * Removes a star the user previously added to a library.
 */
export const unstarLibraryAction = actionClient
    .inputSchema(idSchema)
    .action(async ({ parsedInput: { id } }) => {
        const { userId } = await getUserOrThrow()
        await Kilpi.authed().authorize().assert()

        await unstarLibrary({ libId: id, userId })
        revalidateTag('libraries', 'max')
    })
