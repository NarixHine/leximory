import 'server-only'
import type { Experimental_EvaluationQuestion } from 'ai'
import { EVALUATION_STATE_CONTENT_LIMIT, type EvaluationState } from './evaluate'

export interface ImportLibraryCandidate {
    id: string
    name: string
    langName: string
    shadow: boolean
}

export function libraryChoice({
    title,
    url,
    content,
    candidates,
}: {
    title: string
    url: string
    content: string
    candidates: ImportLibraryCandidate[]
}) {
    const state: EvaluationState = {
        title,
        url,
        content: content.slice(0, EVALUATION_STATE_CONTENT_LIMIT),
    }

    const questions = {
        lib: {
            type: 'choice',
            instructions:
                '根据网页的标题与内容（主题、语言、体裁），选择用户最可能想把它导入的目标文库。必须从给定文库中选出最合适的一个。',
            criteria: Object.fromEntries(
                candidates.map(candidate => [
                    candidate.id,
                    `${candidate.name}（${candidate.langName}${candidate.shadow ? '·词汇仓库' : ''}）`,
                ]),
            ),
        },
    } satisfies Record<string, Experimental_EvaluationQuestion>

    return { state, questions }
}
