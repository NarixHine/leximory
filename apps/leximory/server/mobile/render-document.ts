import { createHash } from 'node:crypto'
import { fromMarkdown } from 'mdast-util-from-markdown'
import type { Nodes, RootContent } from 'mdast'
import sanitize from 'sanitize-html'
import { Parser } from 'htmlparser2'
import {
    renderDocumentSchema, occurrenceSchema,
    type RenderDocument, type RenderBlock, type RenderSpan, type Occurrence,
} from '@repo/schema/mobile'

type Token = { text: string; span: RenderSpan | null; notice: string | null }
type Projection = { text: string; spans: RenderSpan[]; notice: string | null }
const plain = (value: string) => {
    let text = ''
    const parser = new Parser({ ontext: value => { text += value } }, { decodeEntities: true })
    parser.end(sanitize(value, { allowedTags: [], allowedAttributes: {} }))
    return text
}
const definitionMarkdown = (value: string) => {
    let output = ''
    const parser = new Parser({
        ontext: text => { output += text },
        onopentag: name => { output += `<${name}>` },
        onclosetag: name => { output += `</${name}>` },
    }, { decodeEntities: true })
    parser.end(sanitize(value, { allowedTags: ['ruby', 'rt', 'rp'], allowedAttributes: {} }))
    return output
}
const safeURL = (value: string) => {
    try {
        const url = new URL(value)
        return ['https:', 'http:'].includes(url.protocol) ? url.href : null
    } catch { return null }
}

/** Pure projection. Offsets on the wire and mdast source offsets are UTF-16. */
export function renderDocument(source: string): RenderDocument {
    const revision = createHash('sha256').update(source).digest('hex')
    const tokens = new Map<string, Token>()
    let tokenCode = 0xe000
    const reserve = (original: string, token: Token) => {
        while (source.includes(String.fromCharCode(tokenCode))) tokenCode++
        if (tokenCode > 0xf8ff) throw new Error('Render token limit exceeded')
        const key = String.fromCharCode(tokenCode++)
        tokens.set(key, token)
        return original.replace(/[\s\S]/g, key)
    }
    // Keep source offsets intact while suppressing executable HTML and its body.
    let masked = source.replace(/<\/?article\s*>/gi, value => ' '.repeat(value.length)).replace(/<(script|style|iframe|object)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
        value => value.replace(/[^\r\n]/g, ' '))
    masked = masked.replace(/\{\{([^}\n]*)(?:\}\}|$)/gm, (original, body: string) => {
        const fields = body.split('||').map((field, index) => index < 2 ? plain(field)
            : definitionMarkdown(field))
        const text = fields[0] ?? ''
        const lemma = fields[1]
        const definition = fields[2]
        const valid = original.endsWith('}}') && fields.length >= 3 && fields.length <= 5 && fields.every(Boolean)
        return reserve(original, {
            text, notice: valid || fields.length === 1 && original.endsWith('}}') ? null : 'Malformed definition shown as plain text',
            span: valid && lemma && definition ? {
                kind: 'definition', range: { location: 0, length: text.length }, lemma,
                definition, etymology: fields[3] ?? null, cognates: fields[4] ?? null,
            } : null,
        })
    })
    masked = masked.replace(/<ruby\b[^>]*>([\s\S]*?)<\/ruby>/gi, (original, body: string) => {
        const pronunciation = plain(body.match(/<rt\b[^>]*>([\s\S]*?)<\/rt>/i)?.[1] ?? '')
        const text = plain(body.replace(/<(rt|rp)\b[^>]*>[\s\S]*?<\/\1>/gi, ''))
        return reserve(original, {
            text, notice: pronunciation ? null : 'Ruby pronunciation unavailable',
            span: pronunciation && text ? { kind: 'ruby', range: { location: 0, length: text.length }, pronunciation } : null,
        })
    })
    masked = masked.replace(/&&(.+?)&&/g, (original, body: string) => {
        const text = plain(body)
        return reserve(original, { text, notice: null, span: text ? { kind: 'smallcaps', range: { location: 0, length: text.length } } : null })
    })

    const projectText = (value: string): Projection => {
        let text = ''
        const spans: RenderSpan[] = []
        let notice: string | null = null
        for (let i = 0; i < value.length;) {
            const char = value[i] ?? ''
            const token = tokens.get(char)
            if (!token) { text += char; i++; continue }
            while (value[i] === char) i++
            const location = text.length
            text += token.text
            if (token.span) spans.push({ ...token.span, range: { location, length: token.text.length } })
            notice ??= token.notice
        }
        return { text, spans, notice }
    }
    const append = (target: Projection, part: Projection) => {
        target.spans.push(...part.spans.map(span => ({ ...span, range: { ...span.range, location: span.range.location + target.text.length } })))
        target.text += part.text
        target.notice ??= part.notice
    }
    const inline = (nodes: Nodes[]): Projection => {
        const result: Projection = { text: '', spans: [], notice: null }
        for (const node of nodes) {
            let part: Projection
            switch (node.type) {
                case 'text': part = projectText(node.value); break
                case 'break': part = { text: '\n', spans: [], notice: null }; break
                case 'strong': case 'emphasis': {
                    part = inline(node.children)
                    if (part.text) part.spans.push({ kind: node.type, range: { location: 0, length: part.text.length } })
                    break
                }
                case 'inlineCode': {
                    part = projectText(node.value)
                    if (part.text) part.spans.push({ kind: 'code', range: { location: 0, length: part.text.length } })
                    break
                }
                case 'link': {
                    part = inline(node.children)
                    const url = safeURL(node.url)
                    if (url && part.text) part.spans.push({ kind: 'link', url, range: { location: 0, length: part.text.length } })
                    else part.notice ??= 'Link unavailable'
                    break
                }
                case 'image': {
                    const alt = node.alt || 'Image'
                    const text = `\uFFFC ${alt}`
                    const url = safeURL(node.url)
                    part = { text, notice: url ? null : 'Image unavailable', spans: url ? [{ kind: 'image', url, alt, range: { location: 0, length: 1 } }] : [] }
                    break
                }
                case 'html': part = { text: plain(node.value), spans: [], notice: /^<\/?article\s*>$/i.test(node.value) ? null : 'HTML formatting shown as plain text' }; break
                case 'imageReference': part = { text: node.alt || 'Image', spans: [], notice: 'Reference image unavailable' }; break
                case 'linkReference': part = inline(node.children); part.notice ??= 'Reference link shown as plain text'; break
                case 'footnoteReference': part = { text: `[${node.identifier}]`, spans: [], notice: 'Footnote reference' }; break
                default: {
                    // mdast's registry is open to extensions installed elsewhere in the app.
                    part = 'children' in node ? inline(node.children)
                        : projectText('value' in node && typeof node.value === 'string' ? node.value : '')
                    part.notice ??= 'Unsupported formatting shown as plain text'
                }
            }
            append(result, part)
        }
        return result
    }
    const blocks: RenderBlock[] = []
    const emit = (node: Nodes, kind: RenderBlock['kind'], projection: Projection, base: number, audioId: string | null) => {
        const start = node.position?.start.offset
        const end = node.position?.end.offset
        if (start === undefined || end === undefined || end <= start) return
        const sourceRange = { location: base + start, length: end - start }
        const id = createHash('sha256').update(`1:${revision}:${sourceRange.location}:${sourceRange.length}:${blocks.length}`).digest('hex').slice(0, 24)
        blocks.push({ id, kind, sourceRange, displayText: projection.text, spans: projection.spans, audioId, notice: projection.notice })
    }
    const headingKinds = ['heading1', 'heading2', 'heading3', 'heading4', 'heading5', 'heading6'] satisfies RenderBlock['kind'][]
    const visit = (nodes: RootContent[], base: number, audioId: string | null, style?: 'quote' | 'listItem') => {
        for (const node of nodes) {
            switch (node.type) {
                case 'paragraph': emit(node, style ?? 'paragraph', inline(node.children), base, audioId); break
                case 'heading': emit(node, headingKinds[node.depth - 1] ?? 'heading6', inline(node.children), base, audioId); break
                case 'blockquote': visit(node.children, base, audioId, 'quote'); break
                case 'list':
                    node.children.forEach((item, index) => {
                        const before = blocks.length
                        visit(item.children, base, audioId, 'listItem')
                        const first = blocks[before]
                        if (first) {
                            const prefix = node.ordered ? `${(node.start ?? 1) + index}. ` : '• '
                            first.displayText = prefix + first.displayText
                            first.spans = first.spans.map(span => ({ ...span, range: { ...span.range, location: span.range.location + prefix.length } }))
                        }
                    })
                    break
                case 'code': {
                    const projected = projectText(node.value)
                    emit(node, node.lang === 'latex' ? 'fallback' : 'code', { ...projected, notice: node.lang === 'latex' ? 'Math shown as source' : null }, base, audioId)
                    break
                }
                case 'thematicBreak': emit(node, 'divider', { text: '﹡ ﹡ ﹡', spans: [], notice: null }, base, audioId); break
                case 'html': {
                    const projection = projectText(plain(node.value))
                    if (projection.text.trim()) emit(node, 'fallback', { ...projection, notice: 'HTML formatting shown as plain text' }, base, audioId)
                    break
                }
                case 'definition': break
                default: {
                    const start = node.position?.start.offset ?? 0
                    const end = node.position?.end.offset ?? start
                    const projection = projectText(plain(masked.slice(base + start, base + end)))
                    emit(node, 'fallback', { ...projection, notice: 'Unsupported formatting shown as source' }, base, audioId)
                }
            }
        }
    }
    // Audio delimiters are transport metadata. Parse every body and final tail.
    // Code fences are excluded so examples cannot become playback references.
    const codeRanges = fromMarkdown(masked).children.filter(node => node.type === 'code').map(node => node.position)
    const audio = /^:::([A-Za-z0-9_-]+)[^\n]*\n([\s\S]*?)^:::[ \t]*$/gm
    let consumed = 0
    for (const match of masked.matchAll(audio)) {
        if (codeRanges.some(position => match.index >= (position?.start.offset ?? Infinity) && match.index < (position?.end.offset ?? 0))) continue
        const body = match[2] ?? ''
        const id = match[1] ?? null
        visit(fromMarkdown(masked.slice(consumed, match.index)).children, consumed, null)
        const bodyStart = match.index + match[0].indexOf('\n') + 1
        visit(fromMarkdown(body).children, bodyStart, id)
        consumed = match.index + match[0].length
    }
    visit(fromMarkdown(masked.slice(consumed)).children, consumed, null)
    return renderDocumentSchema.parse({ version: 1, revision, source, blocks })
}

export class OccurrenceError extends Error {
    constructor(public readonly code: 'invalid_input' | 'stale_revision') { super(code) }
}

/** Call only after loading and authorizing the requested source document. */
export function resolveOccurrence(document: RenderDocument, input: unknown): { occurrence: Occurrence; selectedText: string; context: string } {
    const parsed = occurrenceSchema.safeParse(input)
    if (!parsed.success) throw new OccurrenceError('invalid_input')
    const occurrence = parsed.data
    if (occurrence.revision !== document.revision) throw new OccurrenceError('stale_revision')
    const block = document.blocks.find(block => block.id === occurrence.blockId)
    if (!block) throw new OccurrenceError('invalid_input')
    const { location, length } = occurrence.range
    const end = location + length
    const text = block.displayText
    if (!Number.isSafeInteger(end) || end > text.length) throw new OccurrenceError('invalid_input')
    const boundaries = new Set([0, text.length])
    for (const segment of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)) boundaries.add(segment.index)
    if (!boundaries.has(location) || !boundaries.has(end)) throw new OccurrenceError('invalid_input')
    return {
        occurrence, selectedText: text.slice(location, end),
        context: `${text.slice(0, location)}[[${text.slice(location, end)}]]${text.slice(end)}`,
    }
}
