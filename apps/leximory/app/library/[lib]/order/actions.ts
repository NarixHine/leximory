'use server'

import { updateTag } from 'next/cache'
import { z } from '@repo/schema'
import { authWriteToLib } from '@/server/auth/role'
import { updateTextOrder } from '@/server/db/text'
import { actionClient } from '@repo/service'

const reorderSchema = z.object({
  lib: z.string(),
  ids: z.array(z.string()),
})

export const reorderTextsAction = actionClient
  .inputSchema(reorderSchema)
  .action(async ({ parsedInput: { lib, ids } }) => {
      await authWriteToLib(lib)
      await updateTextOrder({ lib, ids })
      updateTag(`texts:${lib}`)
  })
