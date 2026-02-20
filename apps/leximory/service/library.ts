'use server'

import { Kilpi } from '@repo/service/kilpi'
import { LIB_ACCESS_STATUS, Lang, SUPPORTED_LANGS } from '@repo/env/config'
import { createLib, deleteLib, updateLib, unstarLib, getLib, starLib } from '@/server/db/lib'
import { addToArchive, removeFromArchive } from '@/server/db/lib'
import { subtractLexicoinBalance, getLibPrice, addLexicoinBalance } from '@/server/db/lexicoin'
import { updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from '@repo/schema'

const saveValidator = z.object({
    id: z.string(),
    name: z.string(),
    access: z.boolean(),
    org: z.string().optional(),
    price: z.coerce.number().nonnegative().max(100),
    prompt: z.string().optional().nullable(),
})

/** Updates a library's metadata after verifying write access via Kilpi. */
export async function save(data: z.infer<typeof saveValidator>) {
    const { id, name, access, org, price, prompt } = saveValidator.parse(data)
    const lib = await getLib({ id })
    await Kilpi.libraries.write(lib).authorize().assert()
    await updateLib({ id, name, access: access ? LIB_ACCESS_STATUS.public : LIB_ACCESS_STATUS.private, org: org ?? null, price, prompt })
    updateTag('libraries')
    return { name, access, org, price }
}

const createValidator = z.object({
    name: z.string(),
    lang: z.enum(SUPPORTED_LANGS),
})

/** Creates a new library owned by the current user and redirects to it. */
export async function create(data: z.infer<typeof createValidator>) {
    const { name, lang } = createValidator.parse(data)
    const { subject } = await Kilpi.authed().authorize().assert()
    const id = await createLib({ name, lang: lang as Lang, owner: subject.userId })
    updateTag('libraries')
    redirect(`/library/${id}`)
}

/** Deletes a library after verifying ownership via Kilpi. */
export async function remove({ id }: { id: string }) {
    const lib = await getLib({ id })
    await Kilpi.libraries.write(lib).authorize().assert()
    await deleteLib({ id })
    updateTag('libraries')
}

/** Archives a library for the current user. */
export async function archive({ id }: { id: string }) {
    const { subject } = await Kilpi.authed().authorize().assert()
    await addToArchive({ userId: subject.userId, libId: id })
    updateTag('libraries')
}

/** Un-archives a library for the current user. */
export async function unarchive({ id }: { id: string }) {
    const { subject } = await Kilpi.authed().authorize().assert()
    await removeFromArchive({ userId: subject.userId, libId: id })
    updateTag('libraries')
}

/** Removes the current user's star from a library. */
export async function unstar({ id }: { id: string }) {
    const { subject } = await Kilpi.authed().authorize().assert()
    await unstarLib({ lib: id, userId: subject.userId })
    updateTag('libraries')
}

/** Stars (purchases) a library using LexiCoin, crediting the owner. */
export async function star(lib: string) {
    const { subject } = await Kilpi.authed().authorize().assert()
    const price = await getLibPrice(lib)
    const { success, message } = await subtractLexicoinBalance(subject.userId, price)
    if (!success) {
        return { success, message }
    }
    await starLib({ lib, userId: subject.userId })
    const libData = await getLib({ id: lib })
    await addLexicoinBalance(libData.owner, price / 5)
    updateTag('libraries')
    return { success: true, message: 'success' }
}
