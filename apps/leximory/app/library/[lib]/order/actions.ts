'use server'

import { updateTag } from 'next/cache'
import { z } from '@repo/schema'
import { authWriteToLib } from '@/server/auth/role'
import { updateTextOrder } from '@/server/db/text'

const reorderSchema = z.object({
  lib: z.string(),
  ids: z.array(z.string()),
})

export async function reorderTexts(props: z.infer<typeof reorderSchema>) {
    const { lib, ids } = reorderSchema.parse(props)
    await authWriteToLib(lib)
    await updateTextOrder({ lib, ids })
    updateTag(`texts:${lib}`)
}
