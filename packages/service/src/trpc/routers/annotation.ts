import 'server-only'

import { z } from '@repo/schema'
import { ACTION_QUOTA_COST, maxArticleLength } from '@repo/env/config'
import incrCommentaryQuota, { maxCommentaryQuota } from '@repo/user/quota'
import { annotateWord, hashPrompt } from '../../ai/annotate'
import { getAnnotationCache } from '@repo/kv'
import { router, publicProcedure } from '../init'

export const annotationRouter = router({
  /**
   * Annotates a word or phrase using AI
   */
  annotateWord: publicProcedure
    .input(z.object({
      prompt: z.string()
    }))
    .mutation(async ({ input }) => {
      const hash = hashPrompt(input.prompt)
      const cache = await getAnnotationCache({ hash })
      if (cache) {
        return { annotation: cache }
      }

      if (input.prompt.length > maxArticleLength('en')) {
        throw new Error('Text too long')
      }
      if (await incrCommentaryQuota(ACTION_QUOTA_COST.wordAnnotation)) {
        return { error: `本月 ${await maxCommentaryQuota()} 词点额度耗尽。` }
      }

      const { annotation } = annotateWord({ prompt: input.prompt })
      return { annotation }
    }),
})
