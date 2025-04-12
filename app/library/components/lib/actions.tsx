'use server'

import { authWriteToLib, getAuthOrThrow } from '@/server/auth/role'
import { libAccessStatusMap, Lang, supportedLangs } from '@/lib/config'
import { createLib, deleteLib, updateLib, unstarLib } from '@/server/db/lib'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { addToArchive, removeFromArchive } from '@/server/db/lib'

const saveValidator = z.object({
    id: z.string(),
    name: z.string(),
    access: z.boolean(),
    org: z.string().optional(),
    price: z.coerce.number().nonnegative().max(100),
})

export async function save(data: z.infer<typeof saveValidator>) {
    const { id, name, access, org, price } = saveValidator.parse(data)
    await authWriteToLib(id)
    await updateLib({ id, name, access: access ? libAccessStatusMap.public : libAccessStatusMap.private, org: org ?? null, price })
    return {
        name,
        access,
        org,
        price,
    }
}

const createValidator = z.object({
    name: z.string(),
    lang: z.enum(supportedLangs),
})

export async function create(data: z.infer<typeof createValidator>) {
    const { name, lang } = createValidator.parse(data)
    const { orgId, userId } = await getAuthOrThrow()
    const id = await createLib({ name, lang: lang as Lang, org: orgId ?? null, owner: userId })
    redirect(`/library/${id}`)
}

export async function remove({ id }: { id: string }) {
    await authWriteToLib(id)
    await deleteLib({ id })
}

export async function archive({ id }: { id: string }) {
    const { userId } = await getAuthOrThrow()
    await addToArchive({ userId, libId: id })
}

export async function unarchive({ id }: { id: string }) {
    const { userId } = await getAuthOrThrow()
    await removeFromArchive({ userId, libId: id })
}

export async function unstar({ id }: { id: string }) {
    const { userId } = await getAuthOrThrow()
    await unstarLib({ lib: id, userId })
}
