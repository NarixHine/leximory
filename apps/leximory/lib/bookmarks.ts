/**
 * Bookmark parsing and lookup helpers for the EPUB reader.
 *
 * Bookmarks are appended to a text's `content` field as Markdown blockquotes.
 * The bookmark action serializes a selection as:
 *
 *     > first line
 *     >
 *     > second line
 *     >
 *     > — *Chapter Name*
 *
 * i.e. every selection line is prefixed with `>`, lines are separated by an
 * empty `>` line, and the (optional) chapter attribution is appended as the
 * final line. This module turns those blocks back into plain selection text so
 * it can be located in the rendered EPUB document.
 */

export interface Bookmark {
    /** The selected text, with bookmark syntax stripped. */
    text: string
    /** The chapter attribution recorded with the bookmark, if any. */
    chapter: string | null
}

const BLOCKQUOTE_LINE = /^ {0,3}>\s?(.*)$/
const CHAPTER_LINE = /^—\s*\*(.+?)\*\s*$/

/**
 * Extracts valid bookmark blocks from an ebook's `content` field.
 *
 * A block is considered a bookmark when every non-empty line is a blockquote
 * line. Blocks are separated by blank lines; the serializer never emits a raw
 * blank line inside a bookmark, so this split keeps blocks intact.
 */
export function parseBookmarks(content: string): Bookmark[] {
    if (!content) return []

    const bookmarks: Bookmark[] = []

    for (const block of content.split(/\n{2,}/)) {
        const lines = block.split('\n')
        const nonEmpty = lines.filter(line => line.trim() !== '')
        if (nonEmpty.length === 0) continue
        if (!nonEmpty.every(line => BLOCKQUOTE_LINE.test(line))) continue

        const body = lines
            .map(line => line.replace(BLOCKQUOTE_LINE, '$1').trimEnd())
            .filter(line => line.trim() !== '')
        if (body.length === 0) continue

        let chapter: string | null = null
        const attribution = body[body.length - 1].match(CHAPTER_LINE)
        if (attribution) {
            chapter = attribution[1].trim()
            body.pop()
        }

        const text = body.join('\n').trim()
        if (!text) continue

        bookmarks.push({ text, chapter })
    }

    return bookmarks
}

interface CharPosition {
    node: Text
    offset: number
}

function collectTextNodes(root: Node): Text[] {
    const document = root.nodeType === Node.DOCUMENT_NODE ? (root as Document) : root.ownerDocument
    if (!document) return []

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const nodes: Text[] = []
    let current = walker.nextNode()
    while (current) {
        nodes.push(current as Text)
        current = walker.nextNode()
    }
    return nodes
}

/**
 * Finds the first occurrence of `query` inside `root` and returns a DOM Range
 * covering it. Matching ignores whitespace differences so selections survive
 * source indentation and line wrapping.
 */
export function findTextRange(root: Node, query: string): Range | null {
    const target = query.replace(/\s+/g, ' ').trim()
    if (!target) return null

    const document = root.nodeType === Node.DOCUMENT_NODE ? (root as Document) : root.ownerDocument
    if (!document) return null

    const nodes = collectTextNodes(root)
    let normalized = ''
    const positions: CharPosition[] = []
    let pendingSpace = false

    for (const node of nodes) {
        const data = node.data
        for (let offset = 0; offset < data.length; offset++) {
            const char = data[offset]
            if (/\s/.test(char)) {
                if (normalized.length > 0) pendingSpace = true
                continue
            }
            if (pendingSpace) {
                normalized += ' '
                positions.push({ node, offset })
                pendingSpace = false
            }
            normalized += char
            positions.push({ node, offset })
        }
    }

    const start = normalized.indexOf(target)
    if (start === -1) return null

    const startPos = positions[start]
    const endPos = positions[start + target.length - 1]
    if (!startPos || !endPos) return null

    const range = document.createRange()
    try {
        range.setStart(startPos.node, startPos.offset)
        range.setEnd(endPos.node, endPos.offset + 1)
    } catch {
        return null
    }
    return range
}
