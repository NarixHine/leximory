import 'server-only'
import type { Experimental_EvaluationQuestion } from 'ai'
import { EVALUATION_STATE_CONTENT_LIMIT, type EvaluationState } from './evaluate'

export const GATE_FAILURE_MESSAGES = {
    paywalled: '网页有付费墙，无法获取正文。',
    paginated: '网页为分页文章，未能抓取全文。',
    blocked: '网页疑似有反爬验证。',
    empty: '未提取到正文。',
    not_article: '网页疑似非文章正文。',
} as const

export type ArticleGateFailure = keyof typeof GATE_FAILURE_MESSAGES

export function articleGate({
    title,
    url,
    content,
}: {
    title: string
    url: string
    content: string
}) {
    const state: EvaluationState = {
        title,
        url,
        content: content.slice(0, EVALUATION_STATE_CONTENT_LIMIT),
    }

    const questions = {
        status: {
            type: 'choice',
            instructions:
                '判断抓取到的网页是否包含可以完整阅读的文章正文。只要正文完整，即使夹杂少量导航、广告、评论、相关阅读等无关内容，也必须判定为 ok；仅当正文缺失或明显不完整时才归入失败类别。',
            criteria: {
                ok: '正文完整可读（可含少量无关内容）',
                paywalled: '订阅墙或付费墙，只能看到提示或预览',
                paginated: '分页文章，未抓取到后续页面，正文在段落中截断',
                blocked: '反爬、人机验证、要求开启 JavaScript 或访问被拒绝',
                empty: '没有任何正文内容',
                not_article: '主体不是文章（如登录页、目录页、评论区、错误页）',
            },
        },
    } satisfies Record<string, Experimental_EvaluationQuestion>

    return { state, questions }
}
