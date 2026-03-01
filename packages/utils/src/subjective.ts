/**
 * Deterministic utility for detecting consecutive word copying from a source text.
 * Used by the Summary marking workflow to identify verbatim copying.
 */

/**
 * Finds all chunks of 4+ consecutive words copied verbatim from the source text
 * in the student's answer. Case-insensitive comparison.
 * @param source - The original passage text (HTML tags will be stripped).
 * @param answer - The student's summary answer.
 * @param minLength - Minimum number of consecutive words to count as copied (default: 4).
 * @returns Array of copied chunks (lowercased, as found in the answer).
 */
export function findCopiedChunks(source: string, answer: string, minLength = 4): string[] {
    const strip = (html: string) => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
    const sourceWords = strip(source).toLowerCase().split(/\s+/)
    const answerWords = strip(answer).toLowerCase().split(/\s+/)
    const sourceSet = new Set<string>()

    // Build a set of all n-grams of length minLength from the source
    for (let i = 0; i <= sourceWords.length - minLength; i++) {
        sourceSet.add(sourceWords.slice(i, i + minLength).join(' '))
    }

    const chunks: string[] = []
    let i = 0
    while (i <= answerWords.length - minLength) {
        const ngram = answerWords.slice(i, i + minLength).join(' ')
        if (sourceSet.has(ngram)) {
            // Extend the match as far as possible
            let end = i + minLength
            while (end < answerWords.length) {
                const extended = answerWords.slice(i, end + 1).join(' ')
                const found = strip(source).toLowerCase().includes(extended)
                if (!found) break
                end++
            }
            chunks.push(answerWords.slice(i, end).join(' '))
            i = end
        } else {
            i++
        }
    }

    return chunks
}

/**
 * Counts the number of words in a text string.
 * @param text - The text to count words in.
 * @returns The word count.
 */
export function countWords(text: string): number {
    const stripped = text.replace(/<[^>]*>/g, '').trim()
    if (!stripped) return 0
    return stripped.split(/\s+/).length
}
