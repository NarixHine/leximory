/**
 * A high-performance, mixed-language safe punctuation fixer.
 * Handles English typography rules correctly even when adjacent to CJK characters.
 */
export function fixDumbPunctuation(text: string): string {
    if (!text) return text

    return text
        // 1. Static Typography
        .replace(/---/g, '—')
        .replace(/--/g, '–')
        .replace(/\.{3}/g, '…')

        // 2. Double Quotes (Simple: Open if after space/start/bracket, else Close)
        .replace(/(^|[\s(\[<{])"/g, '$1“')
        .replace(/"/g, '”')

        // 3. Single Quotes & Apostrophes (The Tricky Part)

        // A. Special Case: Decades/Years (e.g., '90s)
        .replace(/'(?=\d{2}s)/g, '’')

        // B. Apostrophes: If a single quote is preceded by a word character (a-z, 0-9),
        // it MUST be an apostrophe or a closing quote (e.g., don't, users', advice for')
        .replace(/([a-zA-Z0-9])'/g, '$1’')

        // C. Opening Single Quotes: If it's followed by a word character 
        // and wasn't caught by the apostrophe rule, it's an opening quote.
        // This catches the CJK case: 中式，‘give
        .replace(/'(?=[a-zA-Z0-9])/g, '‘')

        // D. Final Cleanup: Any remaining ' (usually preceded by space or punctuation)
        .replace(/'/g, '’')
}
