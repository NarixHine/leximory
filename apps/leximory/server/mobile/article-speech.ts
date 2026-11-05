import { createHash } from 'node:crypto'
import type { RenderDocument } from '@repo/schema/mobile'

/** Use the reader's Leximory projection, never the annotated Markdown source. */
export function articleSpeech(document: RenderDocument): string {
    return document.blocks
        .flatMap((block) => {
            if (block.kind === 'divider') return []
            let text = block.displayText.replace(/\uFFFC/g, '')
            if (block.kind === 'listItem') text = text.replace(/^(?:• |\d+\. )/, '').replace(/^\[[ xX]\]\s+/, '')
            // CommonMark projects GFM tables as paragraphs. Speak their cells, not the delimiters.
            if (block.kind === 'paragraph') {
                const rows = text.split('\n')
                const cells = (row: string) =>
                    row
                        .trim()
                        .replace(/^\||\|$/g, '')
                        .split(/(?<!\\)\|/)
                        .map((cell) => cell.trim())
                if (
                    rows[0]?.includes('|') &&
                    rows[1]?.includes('|') &&
                    cells(rows[1]).every((cell) => /^:?-{3,}:?$/.test(cell))
                ) {
                    text = [rows[0], ...rows.slice(2)].map((row) => cells(row).join(', ')).join('\n')
                }
            }
            return text.trim() ? [text.trim()] : []
        })
        .join('\n\n')
}

export function articleAudioID(textId: string, speech: string): string {
    return (
        'article_' +
        createHash('sha256')
            .update(JSON.stringify([1, textId, speech]))
            .digest('hex')
    )
}

export function existingFullArticleAudioID(document: RenderDocument): string | null {
    const blocks = document.blocks.filter((block) => block.kind !== 'divider' && block.displayText.trim())
    const id = blocks[0]?.audioId
    return id && blocks.every((block) => block.audioId === id) ? id : null
}
