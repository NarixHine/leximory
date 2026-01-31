import { drop } from 'es-toolkit'

export function validateOrThrow(word: string) {
    const isValid = /\{\{([^|}]+)(?:\|\|([^|}]+))?(?:\|\|([^|}]+))?(?:\|\|([^|}]+))?(?:\|\|([^|}]+))?\}\}/g.test(word)
    if (!isValid) {
        const error = new Error('Invalid word') as Error & { cause: string }
        error.cause = word
        throw error
    }
    return word
}

export function extractSaveForm(portions: string[]) {
    const comment = drop(portions, 1)
    return [comment[0]].concat(comment)
}

export function parseWord(word: string): string[] {
    return word.replaceAll('{{', '').replaceAll('}}', '').split('||')
}
