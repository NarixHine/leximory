import LEXICON from './lexicon'
import { CustomLexicon } from './types'
const lemmatize = require('wink-lemmatizer')

export const commentSyntaxRegex = /\{\{([^|}]+)(?:\|\|([^|}]+))?(?:\|\|([^|}]+))?(?:\|\|([^|}]+))?(?:\|\|([^|}]+))?(?:\|\|([^|}]+))?\}\}/g

export function validateOrThrow(word: string) {
    const isValid = /\{\{([^|}]+)(?:\|\|([^|}]+))?(?:\|\|([^|}]+))?(?:\|\|([^|}]+))?(?:\|\|([^|}]+))?\}\}/g.test(word)
    if (!isValid) {
        throw new Error('Invalid word', { cause: word })
    }
    return word
}

export function parseCommentParams(word: string | Array<string>) {
    try {
        const decode = (str: string) => decodeURIComponent(str).replaceAll('{{', '').replaceAll('}}', '').replaceAll('<must>', '').replaceAll('</must>', '')
        const purifiedParams = Array.isArray(word) ? word.map(decode) : decode(word)
        if (Array.isArray(purifiedParams)) {
            return purifiedParams
        }
        let parsedParams: string[]
        try {
            parsedParams = JSON.parse(purifiedParams.split('}')[0])
        } catch {
            parsedParams = purifiedParams.split('}')[0].split(',') as string[]
        }
        return parsedParams
    } catch (e) {
        return ['ERROR', 'ERROR', `在解析注解\`${word}\`时发生错误，请检查注解格式或联系开发者。`]
    }
}

export const originals = (word: string): string[] => [...new Set([lemmatize.verb(word), lemmatize.adjective(word), lemmatize.noun(word)])]

export default function wrap(text: string, lexicon?: CustomLexicon): string {
    // Choose lexicon based on the provided argument
    if (!lexicon || lexicon === 'none') {
        return text
    }
    const words = LEXICON[lexicon]

    const checkAndReplace = (word: string): string => {
        const originalForms = originals(word)
        if (originalForms.some(originalForm => words.includes(originalForm))) {
            return `{{${word}}}`
        }
        return word
    }

    return text.replace(/\b[\w']+\b/g, (match, offset) => {
        // Check if the match is already part of a larger sandwiched phrase or within parentheses
        if (text.lastIndexOf('{{', offset) > text.lastIndexOf('}}', offset) ||
            text.lastIndexOf('(', offset) > text.lastIndexOf(')', offset)) {
            return match // It's part of a larger phrase or within parentheses, don't sandwich
        }
        return checkAndReplace(match) // It's not part of a larger phrase and not within parentheses, sandwich it
    })
}

export function removeRubyFurigana(textWithRuby: string): string {
    return textWithRuby.replace(/<ruby>([^<]+)<rt>[^<]+<\/rt><\/ruby>/g, '$1')
}
