import LEXICON from './lexicon'
const lemmatize = require('wink-lemmatizer')

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
