'use server'

import { z } from '@repo/schema'
import { ACTION_QUOTA_COST, maxArticleLength } from '@repo/env/config'
import incrCommentaryQuota, { maxCommentaryQuota } from '@repo/user/quota'
import { annotateWord, hashPrompt } from '../ai/annotate'
import { getAnnotationCache } from '@repo/kv'
import { actionClient } from '../safe-action-client'

const annotateWordSchema = z.object({
    prompt: z.string()
})

export const annotateWordAction = actionClient
    .inputSchema(annotateWordSchema)
    .action(async ({ parsedInput: { prompt } }) => {
        const hash = hashPrompt(prompt)
        const cache = await getAnnotationCache({ hash })
        if (cache) {
            return { annotation: cache }
        }

        if (prompt.length > maxArticleLength('en')) {
            throw new Error('Text too long')
        }
        if (await incrCommentaryQuota(ACTION_QUOTA_COST.wordAnnotation)) {
            return { error: `本月 ${await maxCommentaryQuota()} 词点额度耗尽。` }
        }

        const { annotation } = annotateWord({ prompt })
        return { annotation }
    })
