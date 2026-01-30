import { ACTION_QUOTA_COST, maxArticleLength } from '@repo/env/config'
import incrCommentaryQuota, { maxCommentaryQuota } from '@repo/user/quota'
import { annotateWord, hashPrompt } from '../ai/annotate'
import { getAnnotationCache } from '@repo/kv'

export async function annotateWordAction({ text }: { text: string }) {
    const hash = hashPrompt(text)
    const cache = await getAnnotationCache({ hash })
    if (cache) {
        return { text: cache }
    }

    if (text.length > maxArticleLength('en')) {
        throw new Error('Text too long')
    }
    if (await incrCommentaryQuota(ACTION_QUOTA_COST.wordAnnotation)) {
        return { error: `本月 ${await maxCommentaryQuota()} 词点额度耗尽。` }
    }
    const { annotation } = annotateWord({ text })
    return { annotation }
}
