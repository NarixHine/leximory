'use server'

import { authReadToLib, authWriteToLib } from '@/server/auth/role'
import { loadWords, retrieveWordsWithRange } from '@/server/db/word'
import { getUserOrThrow } from '@repo/user'
import incrCommentaryQuota, { maxCommentaryQuota } from '@repo/user/quota'
import { inngest } from '@/server/inngest/client'
import { ACTION_QUOTA_COST } from '@repo/env/config'
import { actionClient } from '@repo/service'
import { z } from '@repo/schema'

const loadSchema = z.object({
    lib: z.string(),
    cursor: z.string().optional(),
})

const rangeSchema = z.object({
    lib: z.string(),
    start: z.coerce.date(),
    end: z.coerce.date(),
})

const storySchema = z.object({
    comments: z.array(z.string()),
    lib: z.string(),
    isShadow: z.boolean().optional(),
})

export const loadCorpusAction = actionClient
    .inputSchema(loadSchema)
    .action(async ({ parsedInput: { lib, cursor } }) => {
        await authReadToLib(lib)
        return loadWords({ lib, cursor })
    })

export const drawCorpusAction = actionClient
    .inputSchema(rangeSchema)
    .action(async ({ parsedInput: { lib, start, end } }) => {
        const words = await retrieveWordsWithRange({ lib, start, end })
        return words.map(({ word, id }) => ({ word, id }))
    })

export const getWithinCorpusAction = actionClient
    .inputSchema(rangeSchema)
    .action(async ({ parsedInput: { lib, start, end } }) => {
        const words = await retrieveWordsWithRange({ lib, start, end, size: 50 })
        return words.map(({ word }) => word)
    })

export const generateStoryAction = actionClient
    .inputSchema(storySchema)
    .action(async ({ parsedInput: { comments, lib, isShadow = false } }) => {
        const { userId } = await getUserOrThrow()
        await authWriteToLib(lib)

        if (await incrCommentaryQuota(ACTION_QUOTA_COST.story)) {
            return {
                success: false,
                message: `本月 ${await maxCommentaryQuota()} 词点额度耗尽。`
            }
        }

        await inngest.send({
            name: 'app/story.requested',
            data: {
                comments,
                userId,
                libId: lib
            }
        })

        return {
            success: true,
            message: `生成后故事会出现在${isShadow ? '词汇仓库' : '本文库'}文本内`
        }
    })
