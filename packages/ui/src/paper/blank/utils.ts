import { AlphabeticalMarker } from '../generators/config'

export const highlightSubstrings = (mainString: string, substringsToMatch: string[]): string => {
    let resultString = mainString

    for (const substring of substringsToMatch) {
        // Construct a regular expression that looks for the substring but not if it's already inside a <mark> tag.
        const regex = new RegExp(`(?<!<mark[^>]*>)(?<!</mark[^>]*>)${substring.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&')}(?!</mark>)`, 'gi')
        resultString = resultString.replace(regex, (match) => `<mark class="bg-pink-100 text-pink-900 dark:bg-secondary-100 dark:text-secondary-900 px-0.5 rounded">${match}</mark>`)
    }

    return resultString
}

type Color = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger'
export function matchColor(pattern: [AlphabeticalMarker | undefined, Color][], key: AlphabeticalMarker): Color | undefined {
    for (const [k, v] of pattern) {
        if (k === key) {
            return v
        }
    }
    return undefined
}
