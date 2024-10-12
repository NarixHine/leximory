'use server'

import { authWriteToLib } from '@/lib/auth'
import { getXataClient } from '@/lib/xata'
import { revalidatePath } from 'next/cache'

export async function delComment(id: string, lib: string) {
    const xata = getXataClient()
    await authWriteToLib(lib)
    await xata.db.lexicon.delete(id)
    revalidatePath(`/library/${lib}/corpus`)
    revalidatePath(`/library/`)
}

export async function saveComment(portions: string[], lib: string) {
    const xata = getXataClient()
    const [_, ...comment] = portions
    await authWriteToLib(lib)
    comment[1] = comment[1].replaceAll('\n', '')
    await xata.db.lexicon.createOrUpdate({
        word: `{{${[comment[0]].concat(comment).join('||')}}}`,
        lib
    })
}
