import { ReactNode } from 'react'
import { Text, View } from 'react-native'

/**
 * Simple HTML to React Native converter for basic tags.
 * Handles: p, h1-h6, strong, em, br, code tags
 */
export const parseHtml = (html: string): ReactNode => {
    // Remove <code> tags for now, they will be replaced with blanks
    const cleanHtml = html.replace(/<code>.*?<\/code>/g, '___BLANK___')

    // Split by tags
    const parts: ReactNode[] = []
    let currentText = ''
    let inTag = false
    let tagName = ''
    let tagContent = ''

    for (let i = 0; i < cleanHtml.length; i++) {
        const char = cleanHtml[i]

        if (char === '<') {
            if (currentText) {
                parts.push(<Text key={`text-${i}`}>{currentText}</Text>)
                currentText = ''
            }
            inTag = true
            tagName = ''
            tagContent = ''
        } else if (char === '>' && inTag) {
            inTag = false
            // Extract tag name
            const isClosing = tagName.startsWith('/')
            const actualTagName = isClosing ? tagName.slice(1) : tagName.split(' ')[0]

            // Skip processing closing tags (we don't track nesting properly)
            if (!isClosing) {
                // Handle self-closing or void tags
                if (actualTagName === 'br') {
                    parts.push(<Text key={`br-${i}`}>{'\n'}</Text>)
                }
            }
        } else if (inTag) {
            tagName += char
        } else {
            currentText += char
        }
    }

    if (currentText) {
        parts.push(<Text key={`text-final`}>{currentText}</Text>)
    }

    return <>{parts}</>
}

/**
 * Extracts content from <code> tags in HTML.
 */
export const extractCodeContent = (text: string): string[] => {
    return text.match(/<code>(.*?)<\/code>/g)?.map(c => c.replace(/<\/?code>/g, '')) ?? []
}

/**
 * Replaces <code> tags in HTML with React components.
 * For React Native, we need a different approach than html-react-parser.
 */
export const replaceBlanks = (
    text: string,
    start: number,
    replacer: (displayNo: number, localNo: number, originalContent: string) => ReactNode
): ReactNode => {
    const codeMatches = text.match(/<code>(.*?)<\/code>/g)
    if (!codeMatches || codeMatches.length === 0) {
        return parseSimpleHtml(text)
    }

    const parts: ReactNode[] = []
    let lastIndex = 0
    let questionIndex = 0

    // Find each <code> tag
    const regex = /<code>(.*?)<\/code>/g
    let match

    while ((match = regex.exec(text)) !== null) {
        // Add text before this <code> tag
        if (match.index > lastIndex) {
            const beforeText = text.substring(lastIndex, match.index)
            parts.push(<Text key={`text-${lastIndex}`}>{parseSimpleHtml(beforeText)}</Text>)
        }

        // Add the replacement component
        questionIndex++
        const displayNo = start + questionIndex - 1
        const localNo = questionIndex
        const originalContent = match[1]
        parts.push(<View key={`blank-${questionIndex}`}>{replacer(displayNo, localNo, originalContent)}</View>)

        lastIndex = match.index + match[0].length
    }

    // Add remaining text
    if (lastIndex < text.length) {
        const afterText = text.substring(lastIndex)
        parts.push(<Text key={`text-${lastIndex}`}>{parseSimpleHtml(afterText)}</Text>)
    }

    return <>{parts}</>
}

/**
 * Extracts blanks from HTML text.
 */
export const extractBlanks = (
    text: string,
    start: number,
    replacer: (displayNo: number, localNo: number, originalContent: string) => ReactNode
): ReactNode[] => {
    const blanks: ReactNode[] = []
    const regex = /<code>(.*?)<\/code>/g
    let match
    let questionIndex = 0

    while ((match = regex.exec(text)) !== null) {
        questionIndex++
        const displayNo = start + questionIndex - 1
        const localNo = questionIndex
        const originalContent = match[1]
        blanks.push(replacer(displayNo, localNo, originalContent))
    }

    return blanks
}

/**
 * Simple HTML parser that handles basic formatting tags.
 * Converts HTML to plain text with basic React Native Text styling.
 */
function parseSimpleHtml(html: string): string {
    return html
        .replace(/<\/?p>/g, '\n')
        .replace(/<\/?h[1-6]>/g, '\n')
        .replace(/<br\s*\/?>/g, '\n')
        .replace(/<strong>(.*?)<\/strong>/g, '$1')
        .replace(/<em>(.*?)<\/em>/g, '$1')
        .replace(/<\/?[^>]+(>|$)/g, '') // Remove all other HTML tags
        .replace(/\n+/g, '\n')
        .trim()
}
