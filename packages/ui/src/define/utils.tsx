'use client'

import { type RefObject, useState } from 'react'
import { useEventListener } from 'usehooks-ts'

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

function isRubyAnnotation(element: Element): boolean {
    const tag = element.tagName.toUpperCase()
    return tag === 'RT' || tag === 'RP'
}

function textWithoutRuby(node: Node): string {
    const clone = node.cloneNode(true) as Node
    const root = clone as Element | DocumentFragment
    root.querySelectorAll('rt, rp').forEach(element => element.remove())
    return clone.textContent || ''
}

/** Returns selected text without pronunciation annotations from ruby markup. */
export function getSelectionText(selection: Selection): string {
    if (!selection || selection.rangeCount === 0) return ''
    return textWithoutRuby(selection.getRangeAt(0).cloneContents())
}

const BLOCK_TAGS = new Set([
    'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DD', 'DIV', 'DL', 'DT', 'FIELDSET',
    'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION', 'TABLE',
    'TBODY', 'TD', 'TFOOT', 'TH', 'THEAD', 'TR', 'UL',
])

/**
 * Flattens visible text while skipping ruby annotations and recording which
 * visual line each character belongs to. Line breaks are inferred from `<br>`
 * and block boundaries, so Japanese EPUBs that separate paragraphs with `<br>`
 * inside one element still expose paragraph-sized units instead of one blob.
 */
function extractTextLines(root: Node): { text: string; lineOf: number[] } {
    let text = ''
    const lineOf: number[] = []
    let line = 0

    const visit = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            const data = (node as Text).data
            for (let i = 0; i < data.length; i++) {
                text += data[i]
                lineOf.push(line)
            }
            return
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return
        const element = node as Element
        const tag = element.tagName.toUpperCase()
        if (isRubyAnnotation(element) || tag === 'SCRIPT' || tag === 'STYLE') return
        if (tag === 'BR') {
            line++
            return
        }
        const isBlock = BLOCK_TAGS.has(tag)
        if (isBlock) line++
        element.childNodes.forEach(visit)
        if (isBlock) line++
    }

    visit(root)
    return { text, lineOf }
}

/**
 * Returns the paragraph containing the current selection,
 * with the selected content wrapped in <must>...</must> tags.
 *
 * Handles selections spanning text nodes and nested elements.
 * Falls back to a simple HTML-replacement approach if direct surroundContents fails.
 *
 * @param selection - The Selection object.
 * @param contextRadius Maximum number of characters to include on each side.
 * @param paragraphTags Block elements that may be used as the context boundary.
 * @returns The paragraph containing the current selection, with the selection bracketed.
 */
export function getBracketedSelection(
    selection: Selection,
    contextRadius?: number,
    paragraphTags = ['P', 'DIV', 'BLOCKQUOTE', 'LI'],
): string {
    if (!selection || selection.rangeCount === 0) {
        return ''
    }

    const range = selection.getRangeAt(0)
    const { startContainer } = range
    const allowedTags = new Set(paragraphTags.map(tag => tag.toUpperCase()))

    function findAncestorParagraph(node: Node | null): Element | null {
        while (node) {
            if (node.nodeType === Node.ELEMENT_NODE && allowedTags.has((node as Element).tagName.toUpperCase())) {
                return node as Element
            }
            node = node.parentNode
        }
        return null
    }

    const paragraph = findAncestorParagraph(startContainer)
    if (!paragraph) {
        return ''
    }

    const selectedText = getSelectionText(selection)
    const { text, lineOf } = extractTextLines(paragraph)
    if (!selectedText) {
        return text
    }

    // Find and bracket only the first exact match of the selected text
    const idx = text.indexOf(selectedText)
    if (idx === -1) {
        return ''
    }

    // Clamp the context to the line(s) the selection belongs to so a single
    // selection never pulls in neighbouring paragraphs that share a container.
    const startLine = lineOf[idx] ?? 0
    const endLine = lineOf[idx + selectedText.length - 1] ?? startLine
    const firstCharOfLine = lineOf.indexOf(startLine)
    const lastCharOfLine = lineOf.lastIndexOf(endLine) + 1

    const contextStart = Math.max(
        firstCharOfLine,
        contextRadius === undefined ? 0 : idx - contextRadius,
    )
    const contextEnd = Math.min(
        lastCharOfLine,
        contextRadius === undefined ? text.length : idx + selectedText.length + contextRadius,
    )
    const result =
        text.slice(contextStart, idx) +
        `<must>${selectedText}</must>` +
        text.slice(idx + selectedText.length, contextEnd)
    return result
}

export function useSelection(ref: RefObject<Document>) {
    const [rect, setRect] = useState<DOMRect | null>(null)
    const [selection, setSelection] = useState<Selection | null>(null)

    useEventListener(
        'selectionchange',
        () => {
            const newSelection = getSelection()
            if (!newSelection) {
                if (selection) {
                    resetSelection()
                }
                return
            }
            setRect(
                newSelection.isCollapsed
                    ? null
                    : newSelection.getRangeAt(0).getBoundingClientRect(),
            )
            setSelection(newSelection)
        },
        ref,
    )

    const { left, width, bottom } = rect || {}
    return { selection, left, width, bottom }
}
