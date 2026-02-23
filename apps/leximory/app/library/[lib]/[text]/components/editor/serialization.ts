import showdown from 'showdown'
import { Editor } from '@tiptap/react'

const commentRegex = /\{\{([^|}]+)(?:\|\|([^|}]+))?(?:\|\|([^|}]+))?(?:\|\|([^|}]+))?(?:\|\|([^|}]+))?\}\}/g

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

    processed = processed.replace(commentRegex, commentToHtml)
    let html = converter.makeHtml(processed)

    audioSections.forEach((section, idx) => {
        const innerMd = section.content.replace(commentRegex, commentToHtml)
        const innerHtml = converter.makeHtml(innerMd)
        html = html.replace(
            new RegExp(`<div data-audio-idx="${idx}"></div>`, 'g'),
            `<lexi-audio data-id="${section.id}">${innerHtml}</lexi-audio>`
        )
    })

    return html
}

export function getMarkdownFromEditor(editor: Editor): string {
    // @ts-expect-error tiptap-markdown storage typing
    const md = editor.storage.markdown.getMarkdown() as string

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

    return result
}
