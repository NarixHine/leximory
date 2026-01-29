'use server'

import { authWriteToLib } from '@/server/auth/role'
import { LIB_ACCESS_STATUS, Lang, SUPPORTED_LANGS } from '@repo/env/config'
import { createLib, deleteLib, updateLib, unstarLib } from '@/server/db/lib'
import { redirect } from 'next/navigation'
import { z } from '@repo/schema'
import { addToArchive, removeFromArchive } from '@/server/db/lib'
import { getUserOrThrow } from '@repo/user'
import { updateTag } from 'next/cache'

const saveValidator = z.object({
    id: z.string(),
    name: z.string(),
    access: z.boolean(),
    org: z.string().optional(),
    price: z.coerce.number().nonnegative().max(100),
    prompt: z.string().optional().nullable(),
})

export async function save(data: z.infer<typeof saveValidator>) {
    const { id, name, access, org, price, prompt } = saveValidator.parse(data)
    await authWriteToLib(id)
    await updateLib({ id, name, access: access ? LIB_ACCESS_STATUS.public : LIB_ACCESS_STATUS.private, org: org ?? null, price, prompt })
    updateTag('libraries')
    return {
        name,
        access,
        org,
        price,
    }
}

const createValidator = z.object({
    name: z.string(),
    lang: z.enum(SUPPORTED_LANGS),
})

export async function create(data: z.infer<typeof createValidator>) {
    const { name, lang } = createValidator.parse(data)
    const { userId } = await getUserOrThrow()
    const id = await createLib({ name, lang: lang as Lang, owner: userId })
    updateTag('libraries')
    redirect(`/library/${id}`)
}

export async function remove({ id }: { id: string }) {
    await authWriteToLib(id)
    await deleteLib({ id })
    updateTag('libraries')
}

export async function archive({ id }: { id: string }) {
    const { userId } = await getUserOrThrow()
    await addToArchive({ userId, libId: id })
    updateTag('libraries')
}

export async function unarchive({ id }: { id: string }) {
    const { userId } = await getUserOrThrow()
    await removeFromArchive({ userId, libId: id })
    updateTag('libraries')
}

export async function unstar({ id }: { id: string }) {
    const { userId } = await getUserOrThrow()
    await unstarLib({ lib: id, userId })
    updateTag('libraries')
}
