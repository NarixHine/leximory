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

    // Find the closest <div> or <p> ancestor of a node
    function findAncestorParagraph(node: Node | null): HTMLParagraphElement | null {
        while (node) {
            if (
                node.nodeType === Node.ELEMENT_NODE &&
                ((node as Element).tagName === 'DIV' || (node as Element).tagName === 'P')
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
