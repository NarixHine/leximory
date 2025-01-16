'use server'

import { authWriteToLib, getAuthOrThrow } from '@/lib/auth'
import { libAccessStatusMap, Lang, supportedLangs } from '@/lib/config'
import { createLib, deleteLib, updateLib } from '@/server/db/lib'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const saveValidator = z.object({
    id: z.string(),
    name: z.string(),
    access: z.boolean(),
    shortcut: z.boolean(),
    org: z.string().optional(),
})

export async function save(data: z.infer<typeof saveValidator>) {
    const { id, name, access, shortcut, org } = saveValidator.parse(data)
    await authWriteToLib(id)
    await updateLib({ id, name, access: access ? libAccessStatusMap.public : libAccessStatusMap.private, org: org ?? null, shortcut })
    return {
        name,
        access,
        shortcut,
        org,
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
