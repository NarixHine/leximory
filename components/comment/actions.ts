'use server'

import { authWriteToLib } from '@/lib/auth'
import { extractSaveForm } from '@/lib/lang'
import { getXataClient } from '@/lib/xata'

export async function delComment(id: string) {
    const xata = getXataClient()
    const record = await xata.db.lexicon.filter({ id }).getFirstOrThrow()
    await authWriteToLib(record.lib!.id)
    await xata.db.lexicon.delete(id)
}

export async function saveComment(portions: string[], lib: string) {
    const xata = getXataClient()
    await authWriteToLib(lib)
    const { id } = await xata.db.lexicon.createOrUpdate({
        word: `{{${extractSaveForm(portions).join('||')}}}`,
        lib,
    })
    return id
}
