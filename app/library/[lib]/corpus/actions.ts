'use server'

import { authReadToLib, authWriteToLib } from '@/server/auth/role'
import { loadWords, drawWords } from '@/server/db/word'
import { getAuthOrThrow } from '@/server/auth/role'
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

export async function generateStory({ comments, lib }: { comments: string[], lib: string }) {
    const { userId } = await getAuthOrThrow()
    await authWriteToLib(lib)

    if (await incrCommentaryQuota(2)) {
        return {
            success: false,
            message: `本月 ${await maxCommentaryQuota()} 次 AI 注释生成额度耗尽。该额度为防止滥用而设置，你可以在 B 站联系我们免费提高额度。`
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
        message: '生成后故事会出现在本文库文本内'
    }
}
