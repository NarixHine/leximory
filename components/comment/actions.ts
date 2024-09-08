'use server'

import { authWriteToLib } from '@/lib/auth'
import { originals } from '@/lib/lang'
import { getXataClient } from '@/lib/xata'
import { revalidatePath } from 'next/cache'

export async function delComment(id: string, lib: string) {
    const xata = getXataClient()
    await authWriteToLib(lib)
    await xata.db.lexicon.delete(id)
    revalidatePath(`/library/${lib}/corpus`)
    revalidatePath(`/library/`)
}

export async function loadMeanings(word: string) {
    const xata = getXataClient()
    const words = originals(word)
    const recs = await xata.db.ecdict.filter({ word: { $any: words } }).select(['word', 'translation']).getMany()
    return recs.map(({ word, translation }) => ({ word, translation }))
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
    revalidatePath(`/library/${lib}/corpus`)
}
