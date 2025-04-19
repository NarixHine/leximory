import { ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { z } from 'zod'
import ky from 'ky'
import { customAlphabet } from 'nanoid'

/**
 * Generates a random ID using NanoID.
 * 
 * @returns A random ID.
 */
export const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 12)

/**
 * Fetches an article from a given URL using the Jina API.
 * 
 * @param url - The URL of the article to fetch.
 * @returns An object containing the title and content of the article.
 */
export async function getArticleFromUrl(url: string) {
    const res = await ky.get(url, { prefixUrl: 'https://r.jina.ai', timeout: 60000 }).text()
    const content = (/Markdown Content:\n([\s\S]*)/.exec(res) as string[])[1]
    const title = (/^Title: (.+)/.exec(res) as string[])[1]
    return { title, content }
}

/**
 * Resets the selection to the default state.
 * 
 * @returns void
 */
export function resetSelection() {
    const tempInput = document.createElement('input')
    tempInput.style.cssText = 'position:absolute; left:-9999px; opacity:0;'
    document.body.appendChild(tempInput)
    tempInput.focus()
    setTimeout(() => {
        tempInput.blur()
        tempInput.remove()
    }, 100)
}

/**
 * Returns the paragraph containing the current selection,
 * with the selected content wrapped in <must>...</must> tags.
 *
 * Handles selections spanning text nodes and nested elements.
 * Falls back to a simple HTML-replacement approach if direct surroundContents fails.
 *
 * @param selection - The Selection object.
 * @returns The paragraph containing the current selection, with the selection bracketed.
 */
export function getBracketedSelection(selection: Selection): string {
    if (!selection || selection.rangeCount === 0) {
        return ''
    }

    const range = selection.getRangeAt(0)
    const { startContainer } = range

    // Find the closest <div> ancestor of a node
    function findAncestorParagraph(node: Node | null): HTMLParagraphElement | null {
        while (node) {
            if (
                node.nodeType === Node.ELEMENT_NODE &&
                (node as Element).tagName === 'DIV' ||
                (node as Element).tagName === 'P'
            ) {
                return node as HTMLParagraphElement
            }
            node = node.parentNode
        }
        return null
    }

    const paragraph = findAncestorParagraph(startContainer)
    if (!paragraph) {
        return ''
    }

    const fullText = paragraph.textContent || ''
    const selectedText = selection.toString()
    if (!selectedText) {
        return fullText
    }

    // Find and bracket only the first exact match of the selected text
    const idx = fullText.indexOf(selectedText)
    if (idx === -1) {
        // Fallback if something went wrong
        return fullText
    }

    const result = (
        fullText.slice(0, idx) +
        `<must>${selectedText}</must>` +
        fullText.slice(idx + selectedText.length)
    )
    return result
}

/**
 * Returns the clicked text from an element.
 * 
 * @param element - The HTMLElement to get the clicked text from.
 * @returns The clicked text as a string.
 */
export function getClickedChunk(element: HTMLElement): string {
    if (!element || !element.textContent) return ''

    const parentElement = element.parentElement
    if (!parentElement || !parentElement.textContent) return ''

    const clickedText = element.textContent
    const parentText = parentElement.textContent

    const startIndex = parentText.indexOf(clickedText)
    if (startIndex === -1) return ''

    const endIndex = startIndex + clickedText.length

    return `${parentText.substring(0, startIndex)}[[${clickedText}]]${parentText.substring(endIndex)}`
}

/**
 * Merges class names using Tailwind Merge.
 * 
 * @param inputs - The class values to merge.
 * @returns The merged class names as a string.
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * Parses the body of a request and validates it against a Zod schema.
 * 
 * @param request - The request object.
 * @param schema - The Zod schema to validate against.
 * @returns The parsed and validated data.
 */
export async function parseBody<T>(request: Request, schema: z.ZodSchema<T>) {
    const body = await request.json()
    const { success, data } = schema.safeParse(body)
    if (!success) { throw new Error('Invalid request body') }
    return data
}
