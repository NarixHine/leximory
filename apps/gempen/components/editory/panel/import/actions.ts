'use server'

import { aiSmartImport } from '@/server/ai/import'
import { actionClient } from '@/lib/safe-actions'
import { z } from 'zod'

export const smartImport = actionClient
  .inputSchema(z.file())
  .action(async ({ parsedInput: content }) => {
    const data = await aiSmartImport(content)
    return data
  })
