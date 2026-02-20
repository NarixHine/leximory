'use server'

import { Kilpi } from '@repo/service/kilpi'
import { loadWords, retrieveWordsWithRange } from '@/server/db/word'
import { getUserOrThrow } from '@repo/user'
import incrCommentaryQuota, { maxCommentaryQuota } from '@repo/user/quota'
import { inngest } from '@/server/inngest/client'
import { ACTION_QUOTA_COST } from '@repo/env/config'
import { getLib } from '@/server/db/lib'

/** Loads paginated words from a library after verifying read access via Kilpi. */
export async function load(lib: string, cursor?: string) {
    const libData = await getLib({ id: lib })
    await Kilpi.libraries.read(libData).authorize().assert()
    return await loadWords({ lib, cursor })
}

/** Draws vocabulary from a library within a date range after verifying read access. */
export async function draw({ lib, start, end }: { lib: string, start: Date, end: Date }) {
    const libData = await getLib({ id: lib })
    await Kilpi.libraries.read(libData).authorize().assert()
    const words = await retrieveWordsWithRange({ lib, start, end })
    return words.map(({ word, id }) => ({ word, id }))
}

/** Retrieves words within a date range (up to 50) after verifying read access. */
export async function getWithin({ lib, start, end }: { lib: string, start: Date, end: Date }) {
    const libData = await getLib({ id: lib })
    await Kilpi.libraries.read(libData).authorize().assert()
    const words = await retrieveWordsWithRange({ lib, start, end, size: 50 })
    return words.map(({ word }) => (word))
}

/** Generates a story from vocabulary comments via Inngest, checking quota and library write access. */
export async function generateCorpusStory({ comments, lib, isShadow = false }: { comments: string[], lib: string, isShadow?: boolean }) {
    const { userId } = await getUserOrThrow()
    const libData = await getLib({ id: lib })
    await Kilpi.libraries.write(libData).authorize().assert()

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
}
