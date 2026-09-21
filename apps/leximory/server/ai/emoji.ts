import 'server-only'
import type { Experimental_EvaluationQuestion } from 'ai'
import { EMOJI_CHOICES } from '@/lib/emoji'
import type { EvaluationState } from './evaluate'

export function emojiChoice({ title, filename }: { title: string; filename: string }) {
    const state: EvaluationState = { title, filename }

    const questions = {
        emoji: {
            type: 'choice',
            instructions:
                '根据电子书的书名与文件名判断其主题、体裁与氛围，为它选择最贴切、最有表现力且新颖不落俗套的一个 emoji。必须从给定选项中选出最合适的一个；避免过于泛用、含义重复或与主题无关的选项。',
            criteria: Object.fromEntries(EMOJI_CHOICES.map(emoji => [emoji, null])),
        },
    } satisfies Record<string, Experimental_EvaluationQuestion>

    return { state, questions }
}
