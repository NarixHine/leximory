import showdown from 'showdown'
import { Editor } from '@tiptap/react'
import { commentSyntaxRegex } from '@repo/utils'

function commentToHtml(_: string, ...groups: (string | undefined)[]): string {
    const portions = groups.slice(0, 5).filter(Boolean) as string[]
    const encoded = encodeURIComponent(JSON.stringify(portions))
    return `<lexi-comment data-portions="${encoded}">${portions[0]}</lexi-comment>`
}

export function markdownToHtml(md: string): string {
    const converter = new showdown.Converter({
        tables: true,
        simplifiedAutoLink: true,
        strikethrough: true,
        tasklists: true,
    })

    const audioSections: { id: string; content: string }[] = []
    let processed = md.replace(
        /:::([A-Za-z0-9_-]+).*?\n([\s\S]*?):::/g,
        (_, id, content) => {
            const idx = audioSections.length
            audioSections.push({ id, content: content.trim() })
            return `\n\n<div data-audio-idx="${idx}"></div>\n\n`
        }
    )

    processed = processed.replace(commentSyntaxRegex, commentToHtml)
    processed = processed.replace(/&&(.*?)&&/g, '<span class="convening">$1</span>')
    let html = converter.makeHtml(processed)

    audioSections.forEach((section, idx) => {
        const innerMd = section.content.replace(commentSyntaxRegex, commentToHtml)
        const innerHtml = converter.makeHtml(innerMd)
        html = html.replace(
            new RegExp(`<div data-audio-idx="${idx}"></div>`, 'g'),
            `<lexi-audio data-id="${section.id}">${innerHtml}</lexi-audio>`
        )
    })

    return html
}

export function getMarkdownFromEditor(editor: Editor): string {
    // tiptap-markdown stores its serializer in editor.storage.markdown
    const md = (editor.storage as unknown as Record<string, { getMarkdown: () => string }>).markdown.getMarkdown()

    let result = md

    result = result.replace(
        /<lexi-comment data-portions="([^"]*)">[^<]*<\/lexi-comment>/g,
        (_, encoded: string) => {
            const portions = JSON.parse(decodeURIComponent(encoded)) as string[]
            return `{{${portions.join('||')}}}`
        }
    )

    result = result.replace(
        /<lexi-audio data-id="([^"]*)">([\s\S]*?)<\/lexi-audio>/g,
        (_, id: string, innerContent: string) => {
            return `:::${id}\n${innerContent.trim()}\n:::`
        }
    )

    result = result.replace(
        /<span class="convening">(.*?)<\/span>/g,
        (_, content: string) => {
            return `&&${content}&&`
        }
    )

    return result
}
