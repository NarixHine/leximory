'use server'

import { authReadToLib, authWriteToLib } from '@/lib/auth'
import { getXataClient } from '@/lib/xata'
import { revalidatePath } from 'next/cache'

export default async function load(lib: string, cursor?: string) {
    const xata = getXataClient()
    const { isReadOnly } = await authReadToLib(lib)
    const res = await xata.db.lexicon.filter({ lib }).sort('xata.createdAt', 'desc').select(['lib.name', 'word', 'lib.lang']).getPaginated({
        pagination: { size: 16, after: cursor },
    })
    return { words: res.records.map(({ word, id, lib, xata }) => ({ word, id, date: xata.createdAt.toISOString().split('T')[0], lib: { id: lib!.id, name: lib!.name } })), cursor: res.meta.page.cursor, more: res.meta.page.more, isReadOnly }
}

export const save = async (lib: string, word: string) => {
    'use server'
    const xata = getXataClient()
    await authWriteToLib(lib)
    await xata.db.lexicon.create({
        lib,
        word: `{{${word}}}`
    })
    revalidatePath(`/library/${lib}/corpus`)
}

export async function draw(lib: string, start: Date, end: Date) {
    const xata = getXataClient()
    const records = await xata.db.lexicon.sort('*', 'random').select(['word']).filter({
        $all: [
            {
                'xata.createdAt': { $ge: start }
            },
            {
                'xata.createdAt': { $lt: end }
            },
            {
                lib: { $is: lib }
            }
        ]
    }).getMany({ pagination: { size: 5 } })
    return records.map(({ word, id }) => ({ word, id }))
}
