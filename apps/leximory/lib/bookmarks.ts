/**
 * Bookmark parsing and lookup helpers for the EPUB reader.
 *
 * Bookmarks are stored in a text's `content` field as Markdown blockquotes.
 * The reader's bookmark action serializes a selection as:
 *
 *     > first line
 *     >
 *     > second line
 *     >
 *     > — *Chapter Name*
 *
 * Early saves separated each bookmark with a blank line, but content that has
 * been round-tripped through the editor can collapse adjacent bookmarks into a
 * single blockquote. The parser therefore treats both a blank line and a
 * chapter attribution line (`— *...*`) as bookmark boundaries.
 */

export interface Bookmark {
    /** The selected text, with bookmark syntax stripped. */
    text: string
    /** The chapter attribution recorded with the bookmark, if any. */
    chapter: string | null
}

const BLOCKQUOTE_LINE = /^ {0,3}>\s?(.*)$/
const CHAPTER_LINE = /^—\s*\*(.+?)\*\s*$/
const HAS_ATTRIBUTION = /^ {0,3}> — \*/m

function bookmarkSource(content: string): string {
    if (!/<blockquote\b/i.test(content)) return content

    return content
        .replace(/<blockquote\b[^>]*>/gi, '> ')
        .replace(/<p\b[^>]*>/gi, '\n> ')
        .replace(/<br\s*\/?\s*>/gi, '\n')
        .replace(/<\/\s*(?:p|div|blockquote|h[1-6]|li)\s*>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
}

/**
 * Extracts valid bookmark blocks from an ebook's `content` field.
 *
 * A block is considered a bookmark when every non-empty line is a blockquote
 * line. Blocks end at a blank line or at a chapter attribution line, which lets
 * bookmarks merged into one continuous blockquote be recovered individually.
 */
export function parseBookmarks(content: string): Bookmark[] {
    if (!content) return []

    const bookmarks: Bookmark[] = []
    let body: string[] = []
    let chapter: string | null = null
    let inQuote = false

    const flush = () => {
        if (!inQuote) return
        const text = body.join('\n').trim()
        if (text) bookmarks.push({ text, chapter })
        body = []
        chapter = null
        inQuote = false
    }

    for (const line of bookmarkSource(content).split('\n')) {
        const match = line.match(BLOCKQUOTE_LINE)
        if (match) {
            if (!inQuote) {
                inQuote = true
                body = []
                chapter = null
            }
            const inner = match[1]
            const attribution = inner.match(CHAPTER_LINE)
            if (attribution) {
                chapter = attribution[1].trim()
                flush()
            } else if (inner.trim() !== '') {
                body.push(inner.trim())
            }
        } else {
            flush()
        }
    }
    flush()

    return bookmarks
}

/**
 * Rewrites bookmark blockquotes so each bookmark is rendered as its own
 * blockquote. Only acts when the content actually contains attributed
 * bookmarks, leaving ordinary text untouched.
 */
export function normalizeBookmarks(content: string): string {
    if (!content || !HAS_ATTRIBUTION.test(content)) return content

    const out: string[] = []
    let body: string[] = []
    let chapter: string | null = null
    let inQuote = false

    const ensureBlank = () => {
        if (out.length > 0 && out[out.length - 1] !== '') out.push('')
    }

    const flush = () => {
        if (!inQuote) return
        ensureBlank()
        if (body.length > 0 || chapter) {
            out.push(`> ${body[0] ?? ''}`)
            for (let i = 1; i < body.length; i++) {
                out.push('>')
                out.push(`> ${body[i]}`)
            }
            if (chapter) {
                out.push('>')
                out.push(`> — *${chapter}*`)
            }
        }
        body = []
        chapter = null
        inQuote = false
    }

    for (const line of content.split('\n')) {
        const match = line.match(BLOCKQUOTE_LINE)
        if (match) {
            if (!inQuote) {
                inQuote = true
                body = []
                chapter = null
            }
            const inner = match[1]
            const attribution = inner.match(CHAPTER_LINE)
            if (attribution) {
                chapter = attribution[1].trim()
                flush()
            } else if (inner.trim() !== '') {
                body.push(inner.trim())
            }
        } else if (line.trim() === '') {
            flush()
            ensureBlank()
        } else {
            flush()
            out.push(line)
        }
    }
    flush()

    return out.join('\n')
}

interface CharPosition {
    node: Text
    offset: number
}

/**
 * Bookmark text is stored as Markdown, so punctuation may be backslash-escaped
 * (e.g. `\[508/7\]`). The rendered EPUB contains the literal characters, so
 * escapes must be removed before searching.
 */
function stripMarkdownEscapes(text: string): string {
    return text
        .replace(/\\([!-/:-@[-`{-~])/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        .replace(/(?<!\w)\*([^*]+)\*(?!\w)/g, '$1')
        .replace(/(?<!\w)_([^_]+)_(?!\w)/g, '$1')
}

function collectTextNodes(root: Node): Text[] {
    const document = root.nodeType === Node.DOCUMENT_NODE ? (root as Document) : root.ownerDocument
    if (!document) return []

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const nodes: Text[] = []
    if (root.nodeType === Node.TEXT_NODE) nodes.push(root as Text)
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
    const target = stripMarkdownEscapes(query).replace(/\s+/g, ' ').trim()
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

/** Wraps the text covered by a range without changing the surrounding EPUB structure. */
export function highlightTextRange(
    range: Range,
    isDark: boolean,
): number {
    const root = range.commonAncestorContainer
    const document = root.ownerDocument
    if (!document) return 0

    if (
        range.startContainer === range.endContainer &&
        range.startContainer.nodeType === Node.TEXT_NODE
    ) {
        const node = range.startContainer as Text
        const selected = range.startOffset > 0 ? node.splitText(range.startOffset) : node
        const length = range.endOffset - range.startOffset
        if (length <= 0) return 0
        if (length < selected.length) selected.splitText(length)

        if (selected.parentElement?.closest('[data-leximory-bookmark]')) return 0
        const mark = document.createElement('span')
        mark.dataset.leximoryBookmark = 'true'
        mark.style.setProperty(
            'background-image',
            `linear-gradient(to bottom, transparent 45%, ${isDark ? 'rgb(123 191 99 / 0.35)' : 'rgb(183 224 143 / 0.5)'} 45%, ${isDark ? 'rgb(123 191 99 / 0.35)' : 'rgb(183 224 143 / 0.5)'} 82%, transparent 82%)`,
            'important',
        )
        mark.style.setProperty('color', 'inherit', 'important')
        mark.style.setProperty('mix-blend-mode', isDark ? 'screen' : 'multiply')
        mark.style.setProperty('-webkit-box-decoration-break', 'clone')
        selected.parentNode?.insertBefore(mark, selected)
        mark.appendChild(selected)
        return 1
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const nodes: Text[] = []
    let current = walker.nextNode()
    while (current) {
        nodes.push(current as Text)
        current = walker.nextNode()
    }

    let wrapped = 0
    for (const node of nodes) {
        if (!node.parentElement || node.parentElement.closest('[data-leximory-bookmark]')) {
            continue
        }

        let intersects = false
        try {
            intersects = range.intersectsNode(node)
        } catch {
            continue
        }
        if (!intersects) continue

        const start = node === range.startContainer ? range.startOffset : 0
        const end = node === range.endContainer ? range.endOffset : node.length
        if (end <= start) continue

        const selected = start > 0 ? node.splitText(start) : node
        if (end - start < selected.length) selected.splitText(end - start)

        const mark = document.createElement('span')
        mark.dataset.leximoryBookmark = 'true'
        mark.style.setProperty(
            'background-image',
            `linear-gradient(to bottom, transparent 45%, ${isDark ? 'rgb(123 191 99 / 0.35)' : 'rgb(183 224 143 / 0.5)'} 45%, ${isDark ? 'rgb(123 191 99 / 0.35)' : 'rgb(183 224 143 / 0.5)'} 82%, transparent 82%)`,
            'important',
        )
        mark.style.setProperty('color', 'inherit', 'important')
        mark.style.setProperty('mix-blend-mode', isDark ? 'screen' : 'multiply')
        mark.style.setProperty('-webkit-box-decoration-break', 'clone')
        selected.parentNode?.insertBefore(mark, selected)
        mark.appendChild(selected)
        wrapped++
    }

    return wrapped
}
