'use server'

import { authWriteToLib } from '@/server/auth/role'
import { createText, setTextAnnotationProgress } from '@/server/db/text'
import { generate } from '../../[text]/actions'
import { getUserOrThrow } from '@/server/auth/user'
import { getVisitedTextIds } from '@/server/db/visited'
import { redirect } from 'next/navigation'

export async function add({ title, lib }: { title: string, lib: string }) {
    await authWriteToLib(lib)
    const id = await createText({ lib, title })
    redirect(`/library/${lib}/${id}`)
}

export async function addAndGenerate({ title, content, lib }: { title: string, content: string, lib: string }) {
    await authWriteToLib(lib)
    const id = await createText({ lib, title, content })
    await generate({ article: content, textId: id, onlyComments: false })
    await setTextAnnotationProgress({ id, progress: 'annotating' })
    redirect(`/library/${lib}/${id}`)
}

export async function getVisitedTexts(libId: string) {
    const { userId } = await getUserOrThrow()
    return await getVisitedTextIds({ libId, userId })
}
