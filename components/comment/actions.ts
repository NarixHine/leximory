'use server'

import { authWriteToLib } from '@/lib/auth'
import { getXataClient } from '@/lib/xata'
import { revalidatePath } from 'next/cache'

export async function delComment(id: string) {
    const xata = getXataClient()
    const record = await xata.db.lexicon.filter({ id }).getFirstOrThrow()
    await authWriteToLib(record.lib!.id)
    await xata.db.lexicon.delete(id)
    revalidatePath(`/library/${record.lib!.id}/corpus`)
    revalidatePath(`/library/`)
}

export async function saveComment(portions: string[], lib: string) {
    const xata = getXataClient()
    const [_, ...comment] = portions
    await authWriteToLib(lib)
    await xata.db.lexicon.createOrUpdate({
        word: `{{${[comment[0]].concat(comment).join('||')}}}`,
        lib
    })
}
