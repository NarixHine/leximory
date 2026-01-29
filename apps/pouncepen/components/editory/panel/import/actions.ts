'use server'

import { aiSmartImport } from '@/server/ai/import'
import { actionClient } from '@repo/service'
import { z } from '@repo/schema'
import incrCommentaryQuota from '@repo/user/quota'
import { ACTION_QUOTA_COST } from '@repo/env/config'

export const smartImport = actionClient
  .inputSchema(z.file())
  .action(async ({ parsedInput: content }) => {
    if (await incrCommentaryQuota(ACTION_QUOTA_COST.pouncepen.import)) {
      throw new Error('You have reached your commentary quota limit.')
    }
    const data = await aiSmartImport(content)
    return data
  })
