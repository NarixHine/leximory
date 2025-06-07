'use server'

import { authReadToLib, authWriteToLib } from '@/server/auth/role'
import { loadWords, drawWords } from '@/server/db/word'
import { getUserOrThrow } from '@/server/auth/user'
import incrCommentaryQuota, { maxCommentaryQuota } from '@/server/auth/quota'
import { inngest } from '@/server/inngest/client'

export default async function load(lib: string, cursor?: string) {
    await authReadToLib(lib)
    return await loadWords({ lib, cursor })
}

export async function draw({ lib, start, end }: { lib: string, start: Date, end: Date }) {
    const words = await drawWords({ lib, start, end, size: 5 })
    return words.map(({ word, id }) => ({ word, id }))
}

export async function getWithin({ lib, start, end }: { lib: string, start: Date, end: Date }) {
    const words = await drawWords({ lib, start, end, size: 50 })
    return words.map(({ word }) => (word))
}

export async function generateStory({ comments, lib, isShadow = false }: { comments: string[], lib: string, isShadow?: boolean }) {
    const { userId } = await getUserOrThrow()
    await authWriteToLib(lib)

    if (await incrCommentaryQuota(2)) {
        return {
            success: false,
            message: `本月 ${await maxCommentaryQuota()} 次 AI 注释生成额度耗尽。`
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
}
