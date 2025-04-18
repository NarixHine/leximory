'use server'

import { authWriteToLib } from '@/server/auth/role'
import { createText } from '@/server/db/text'
import { generate } from '../../[text]/actions'

export async function add({ title, lib }: { title: string, lib: string }) {
    await authWriteToLib(lib)
    const id = await createText({ lib, title })
    return id
}

export async function addAndGenerate({ title, content, lib }: { title: string, content: string, lib: string }) {
    await authWriteToLib(lib)
    const id = await createText({ lib, title, content })
    await generate({ article: content, textId: id, onlyComments: false })
    return id
}
