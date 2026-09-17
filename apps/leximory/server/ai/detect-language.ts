import 'server-only'
import type { Experimental_EvaluationQuestion } from 'ai'

export function wordLanguageQuestion(word: string) {
    return {
        state: word,
        questions: {
            language: {
                type: 'choice',
                instructions:
                    'The state is a single word or phrase. Identify the language it most likely belongs to.',
                criteria: {
                    en: 'English',
                    fr: 'French',
                    ja: 'Japanese',
                },
            },
        } satisfies Record<string, Experimental_EvaluationQuestion>,
    }
}
