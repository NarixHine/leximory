import { parseHTML } from 'linkedom'
import createDOMPurify, { Config } from 'dompurify'
import { HTMLReactParserOptions } from 'html-react-parser'
import parse from 'html-react-parser'

// 1. Create the pseudo-window. 
// We use a minimal string because DOMPurify just needs the environment.
const { window } = parseHTML('<!DOCTYPE html><html><body></body></html>')
// 2. Initialize DOMPurify with that window.
const DOMPurify = createDOMPurify(window)

export function sanitizeHTML(html: string, options?: Config): string {
    return DOMPurify.sanitize(html, options)
}

/**
 * Safely parses and sanitizes HTML content to prevent XSS attacks.
 * Uses DOMPurify to sanitize the input HTML string before parsing it into React nodes.
 *
 * @param html - The HTML string to parse and sanitize.
 * @param options - Optional parsing options for html-react-parser.
 * @returns The parsed and sanitized React nodes.
 */
export const safeParseHTML = (html: string, options?: HTMLReactParserOptions): ReturnType<typeof parse> => {
    const sanitizedHtml = sanitizeHTML(html)
    return parse(sanitizedHtml, options)
}
