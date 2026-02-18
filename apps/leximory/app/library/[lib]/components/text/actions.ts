'use server'

import { authWriteToLib } from '@/server/auth/role'
import { createText, setTextAnnotationProgress } from '@/server/db/text'
import { generate } from '../../[text]/actions'
import { getUserOrThrow } from '@repo/user'
import { getVisitedTextIds } from '@/server/db/visited'
import { redirect } from 'next/navigation'
import { updateTag } from 'next/cache'
import { actionClient } from '@repo/service'
import { z } from '@repo/schema'

const addSchema = z.object({
    title: z.string(),
    lib: z.string(),
})

const addAndGenerateSchema = z.object({
    title: z.string(),
    content: z.string(),
    lib: z.string(),
})

const visitedSchema = z.object({
    libId: z.string(),
})

export const addTextAction = actionClient
    .inputSchema(addSchema)
    .action(async ({ parsedInput: { title, lib } }) => {
        await authWriteToLib(lib)
        const id = await createText({ lib, title })
        updateTag(`texts:${lib}`)
        redirect(`/library/${lib}/${id}`)
    })

export const addAndGenerateTextAction = actionClient
    .inputSchema(addAndGenerateSchema)
    .action(async ({ parsedInput: { title, content, lib } }) => {
        await authWriteToLib(lib)
        const id = await createText({ lib, title, content })
        updateTag(`texts:${lib}`)
        await generate({ article: content, textId: id, onlyComments: false })
        await setTextAnnotationProgress({ id, progress: 'annotating' })
        redirect(`/library/${lib}/${id}`)
    })

export const getVisitedTextsAction = actionClient
    .inputSchema(visitedSchema)
    .action(async ({ parsedInput: { libId } }) => {
        const { userId } = await getUserOrThrow()
        const visited = await getVisitedTextIds({ libId, userId })
        return visited
    })
