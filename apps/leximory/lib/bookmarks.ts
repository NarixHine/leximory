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
 * Classifies an ebook's `content` as either a pure set of attributed bookmarks
 * or content that also holds prose.
 *
 * The one-time bookmark migration uses this to decide whether `content` can be
 * cleared: only content where every non-blank line belongs to an attributed
 * bookmark block is considered pure. Any prose, or any blockquote without a
 * chapter attribution, marks the content as not pure so it is preserved.
 */
export function analyzeBookmarks(content: string): {
    bookmarks: Bookmark[]
    isPureBookmarks: boolean
} {
    if (!content) return { bookmarks: [], isPureBookmarks: false }

    const bookmarks = parseBookmarks(content)
    if (bookmarks.length === 0 || bookmarks.some(bookmark => !bookmark.chapter)) {
        return { bookmarks, isPureBookmarks: false }
    }

    const hasOtherContent = bookmarkSource(content)
        .split('\n')
        .some(line => line.trim() !== '' && !BLOCKQUOTE_LINE.test(line))

    return { bookmarks, isPureBookmarks: !hasOtherContent }
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

function isRubyAnnotation(node: Node): boolean {
    let parent = node.parentNode
    while (parent?.nodeType === Node.ELEMENT_NODE) {
        const tagName = (parent as Element).tagName.toLowerCase()
        if (tagName === 'rt' || tagName === 'rp') return true
        parent = parent.parentNode
    }
    return false
}

function collectTextNodes(root: Node): Text[] {
    const document = root.nodeType === Node.DOCUMENT_NODE ? (root as Document) : root.ownerDocument
    if (!document) return []

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const nodes: Text[] = []
    if (root.nodeType === Node.TEXT_NODE && !isRubyAnnotation(root)) nodes.push(root as Text)
    let current = walker.nextNode()
    while (current) {
        if (!isRubyAnnotation(current)) nodes.push(current as Text)
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

/** Wraps the text covered by a range in one stable highlight element. */
export function highlightTextRange(
    range: Range,
    isDark: boolean,
): number {
    const root = range.commonAncestorContainer
    const document = root.ownerDocument
    if (!document) return 0

    const applyHighlight = (element: HTMLElement) => {
        element.dataset.leximoryBookmark = 'true'
        element.style.setProperty(
            'background-color',
            isDark ? 'rgb(105 170 78 / 0.45)' : 'rgb(183 224 143 / 0.45)',
            'important',
        )
        element.style.setProperty('color', 'inherit', 'important')
        element.style.setProperty('-webkit-box-decoration-break', 'clone')
    }

    const elementFor = (node: Node) =>
        node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
    const startElement = elementFor(range.startContainer)
    const endElement = elementFor(range.endContainer)
    if (
        startElement?.closest('[data-leximory-bookmark]') ||
        endElement?.closest('[data-leximory-bookmark]')
    ) {
        return 0
    }

    const highlightRange = range.cloneRange()
    const startRuby = startElement?.closest('ruby')
    const endRuby = endElement?.closest('ruby')
    if (startRuby) highlightRange.setStartBefore(startRuby)
    if (endRuby) highlightRange.setEndAfter(endRuby)

    const mark = document.createElement('span')
    applyHighlight(mark)
    try {
        mark.appendChild(highlightRange.extractContents())
        highlightRange.insertNode(mark)
    } catch {
        return 0
    }
    return 1
}
