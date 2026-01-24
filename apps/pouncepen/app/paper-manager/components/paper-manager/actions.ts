'use server'

import { actionClient } from '@/lib/safe-actions'
import { z } from 'zod'
import { createPaper, getPapersByCreator, updatePaper, deletePaper, togglePaperVisibility } from '@repo/supabase/paper'
import { getUserOrThrow } from '@repo/user'

const createPaperSchema = z.object({
  title: z.string(),
  public: z.boolean().optional(),
})

const updatePaperSchema = z.object({
  id: z.number(),
  title: z.string().optional(),
  public: z.boolean().optional(),
})

export const createPaperAction = actionClient
  .inputSchema(createPaperSchema)
  .action(async ({ parsedInput }) => {
    const user = await getUserOrThrow()
    return createPaper({
      data: {
        ...parsedInput,
        creator: user.userId,
      },
    })
  })

export const getPapersAction = actionClient.action(async () => {
  const user = await getUserOrThrow()
  return getPapersByCreator({ creator: user.userId })
})

export const updatePaperAction = actionClient
  .inputSchema(updatePaperSchema)
  .action(async ({ parsedInput }) => {
    const { id, ...data } = parsedInput
    return updatePaper({ id, data })
  })

export const deletePaperAction = actionClient
  .inputSchema(z.object({ id: z.number() }))
  .action(async ({ parsedInput }) => {
    return deletePaper({ id: parsedInput.id })
  })

export const togglePaperVisibilityAction = actionClient
  .inputSchema(z.object({ id: z.number() }))
  .action(async ({ parsedInput }) => {
    return togglePaperVisibility({ id: parsedInput.id })
  })