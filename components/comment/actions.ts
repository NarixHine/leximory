'use server'

import { authWriteToLib } from '@/lib/auth'
import { extractSaveForm, validateOrThrow } from '@/lib/lang'
import { getXataClient } from '@/lib/xata'
import { revalidatePath } from 'next/cache'

const xata = getXataClient()

export async function delComment(id: string) {
    const record = await xata.db.lexicon.filter({ id }).getFirstOrThrow()
    await authWriteToLib(record.lib!.id)
    await xata.db.lexicon.delete(id)
}

export async function saveComment(portions: string[], lib: string, editId?: string) {
    const word = `{{${extractSaveForm(portions.filter(Boolean)).join('||')}}}`
    validateOrThrow(word)

    await authWriteToLib(lib)
    const { id } = await xata.db.lexicon.createOrUpdate({
        word,
        lib,
        id: editId,
    })
    return id
}

export async function modifyText(id: string, modifiedText: string) {
    const text = await xata.db.texts.filter({ id }).getFirstOrThrow()
    await authWriteToLib(text.lib!.id)
    await xata.db.texts.update(id, {
        content: modifiedText,
    })
    revalidatePath(`/library/${text.lib!.id}/${id}`)
}
