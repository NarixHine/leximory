import { Editor, Node, Mark, mergeAttributes } from '@tiptap/core'
import { commentSyntaxRegex } from '@repo/utils/comment'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import {
    markdownToHtml,
    getMarkdownFromEditor,
} from '../../leximory/app/library/[lib]/[text]/components/editor/serialization.ts'

const comment = Node.create({
    name: 'comment',
    group: 'inline',
    inline: true,
    atom: true,
    addAttributes() {
        return {
            portions: {
                default: [],
                parseHTML: (element) =>
                    JSON.parse(decodeURIComponent(element.getAttribute('data-portions') || '%5B%5D')),
                renderHTML: (attrs) => ({ 'data-portions': encodeURIComponent(JSON.stringify(attrs.portions)) }),
            },
        }
    },
    parseHTML() {
        return [{ tag: 'lexi-comment' }]
    },
    renderHTML({ node, HTMLAttributes }) {
        return ['lexi-comment', mergeAttributes(HTMLAttributes), node.attrs.portions[0] || '']
    },
})
const audio = Node.create({
    name: 'audioSection',
    group: 'block',
    content: 'block+',
    defining: true,
    addAttributes() {
        return {
            id: {
                default: '',
                parseHTML: (element) => element.getAttribute('data-id'),
                renderHTML: (attrs) => ({ 'data-id': attrs.id }),
            },
        }
    },
    parseHTML() {
        return [{ tag: 'lexi-audio' }]
    },
    renderHTML({ HTMLAttributes }) {
        return ['lexi-audio', HTMLAttributes, 0]
    },
})
const smallcaps = Mark.create({
    name: 'smallcaps',
    parseHTML() {
        return [{ tag: 'span.smallcaps' }]
    },
    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(HTMLAttributes, { class: 'smallcaps' }), 0]
    },
})
// Keep structures outside StarterKit's schema intact when editing surrounding prose.
// Their sanitized preview stays visible; the exact source is serialized back unchanged.
const preserved = Node.create({
    name: 'preserved',
    group: 'block',
    atom: true,
    addAttributes() {
        return { source: { default: '' }, preview: { default: '' } }
    },
    parseHTML() {
        return [
            {
                tag: 'lexi-preserved',
                getAttrs: (element) => ({ source: element.dataset.source, preview: element.innerHTML }),
            },
        ]
    },
    renderHTML({ node }) {
        return ['lexi-preserved', { 'data-source': node.attrs.source }, node.attrs.preview.replace(/<[^>]*>/g, '')]
    },
    addNodeView() {
        return ({ node }) => {
            const dom = document.createElement('div')
            dom.className = 'preserved'
            dom.contentEditable = 'false'
            dom.innerHTML = node.attrs.preview
            return { dom }
        }
    },
    addStorage() {
        return {
            markdown: {
                serialize(state, node) {
                    state.write(decodeURIComponent(node.attrs.source))
                    state.closeBlock(node)
                },
            },
        }
    },
})
function safeHTML(source) {
    const parsed = new DOMParser().parseFromString(source, 'text/html')
    parsed
        .querySelectorAll('script,style,iframe,object,embed,link,meta,base,form,input,button,textarea,svg,math')
        .forEach((element) => element.remove())
    for (const element of parsed.body.querySelectorAll('*')) {
        for (const attr of Array.from(element.attributes)) {
            if (!['data-portions', 'data-id', 'data-source', 'class', 'colspan', 'rowspan'].includes(attr.name))
                element.removeAttribute(attr.name)
        }
    }
    return parsed.body.innerHTML
}
function prepare(markdown) {
    // Placeholders prevent the editor from silently dropping tables, images, HTML and ruby.
    const parts = []
    const protect = (source) => {
        const index = parts.push(source) - 1
        return `\n\n<div data-preserve="${index}"></div>\n\n`
    }
    const comments = []
    const token = `LEXI${crypto.randomUUID().replaceAll('-', '')}`
    const tokens = new RegExp(token + '([0-9]+)END', 'g')
    const restore = (value) => value.replace(tokens, (_, index) => comments[Number(index)])
    let source = markdown.replace(commentSyntaxRegex, (match) => `${token}${comments.push(match) - 1}END`)
    source = source.replace(/<([a-z][\w-]*)\b[^>]*>[\s\S]*?<\/\1>/gi, protect)
    source = source.replace(/(^\|.+\|[^\n]*\n\|[\s:|\-]+\|[^\n]*(?:\n\|.*\|[^\n]*)*)/gm, protect)
    source = source.replace(/^\s*!\[[^\]]*\]\([^\n]+\)\s*$/gm, protect)
    source = restore(source)
    let html = markdownToHtml(source)
    html = html.replace(/<div data-preserve="(\d+)"><\/div>/g, (_, index) => {
        const original = restore(parts[Number(index)])
        return `<lexi-preserved data-source="${encodeURIComponent(original)}">${safeHTML(markdownToHtml(original))}</lexi-preserved>`
    })
    return safeHTML(html)
}
let editor
let original = ''
let changed = false
const bridge = (kind, extra = {}) => window.webkit?.messageHandlers.editor.postMessage({ kind, ...extra })
window.lexiEditor = {
    load(markdown, fontSize, fontFamily) {
        editor?.destroy()
        original = markdown
        changed = false
        document.documentElement.style.setProperty('--size', `${fontSize}px`)
        document.documentElement.style.setProperty('--font', fontFamily)
        editor = new Editor({
            element: document.getElementById('editor'),
            extensions: [
                StarterKit.configure({ link: false, underline: false }),
                Markdown.configure({ html: true, transformPastedText: true, transformCopiedText: true }),
                comment,
                audio,
                smallcaps,
                preserved,
            ],
            content: prepare(markdown),
            editorProps: {
                attributes: { 'aria-label': '文章正文', spellcheck: 'false' },
                transformPastedHTML: safeHTML,
            },
            onUpdate() {
                changed = true
                bridge('change')
            },
            onSelectionUpdate() {
                bridge('selection')
            },
        })
        bridge('loaded')
    },
    markdown() {
        return changed ? getMarkdownFromEditor(editor) : original
    },
    command(name) {
        const chain = editor.chain().focus()
        switch (name) {
            case 'bold':
                chain.toggleBold().run()
                break
            case 'italic':
                chain.toggleItalic().run()
                break
            case 'heading':
                chain.toggleHeading({ level: 2 }).run()
                break
            case 'quote':
                chain.toggleBlockquote().run()
                break
            case 'list':
                chain.toggleBulletList().run()
                break
            case 'undo':
                chain.undo().run()
                break
            case 'redo':
                chain.redo().run()
                break
        }
    },
    insertText(text) {
        editor.commands.insertContentAt(editor.state.doc.content.size - 1, { type: 'text', text })
    },
}
bridge('ready')
