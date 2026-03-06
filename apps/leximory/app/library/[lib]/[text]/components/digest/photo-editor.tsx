'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { HighlightMark } from '../editor/extensions/highlight-mark'
import { BubbleMenu } from '@tiptap/react/menus'
import { Button, ButtonGroup } from '@heroui/button'
import { PiHighlighterBold } from 'react-icons/pi'
import { useRef, useCallback } from 'react'

/** Convert `[[word]]` markers to `<mark>` tags for Tiptap. */
function bracketToHtml(text: string): string {
    return text.replace(/\[\[(.+?)\]\]/g, '<mark>$1</mark>')
}

/** Convert Tiptap HTML `<mark>` tags back to `[[word]]` markers. */
function htmlToBracket(html: string): string {
    return html
        .replace(/<mark[^>]*>(.*?)<\/mark>/g, '[[$1]]')
        // Insert newlines at block boundaries before stripping tags
        .replace(/<\/p>\s*<p/gi, '</p>\n<p')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(?:p|div|h[1-6]|li|blockquote)>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        // Collapse more than two consecutive newlines
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

/** Escape HTML special chars, but preserve `<mark>` tags. */
function escapeHtmlPreserveMark(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/&lt;mark&gt;/g, '<mark>')
        .replace(/&lt;\/mark&gt;/g, '</mark>')
}

interface PhotoEditorProps {
    initialText: string
    onChange: (text: string) => void
    className?: string
}

export default function PhotoEditor({ initialText, onChange, className }: PhotoEditorProps) {
    const initialHtml = useRef(
        bracketToHtml(initialText)
            .split('\n')
            .map(line =>
                line === ''
                    ? '<p><br /></p>'
                    : `<p>${escapeHtmlPreserveMark(line)}</p>`
            )
            .join('')
    )

    const handleUpdate = useCallback(({ editor }: { editor: ReturnType<typeof useEditor> }) => {
        if (!editor) return
        onChange(htmlToBracket(editor.getHTML()))
    }, [onChange])

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                link: false,
            }),
            HighlightMark,
        ],
        content: initialHtml.current,
        editorProps: {
            attributes: {
                class: [
                    'focus:outline-none prose dark:prose-invert prose-lg font-formal',
                    'min-h-40 max-w-none',
                    className ?? '',
                ].join(' '),
            },
        },
        editable: true,
        immediatelyRender: false,
        shouldRerenderOnTransaction: true,
        onUpdate: handleUpdate,
    })

    if (!editor) return null

    return (
        <div className='w-full'>
            <BubbleMenu
                editor={editor}
                pluginKey='highlightBubble'
                updateDelay={250}
                options={{
                    placement: 'top',
                    flip: true,
                    offset: 10,
                    strategy: 'absolute',
                }}
                shouldShow={({ state }) => !state.selection.empty}
            >
                <ButtonGroup radius='full' className='bg-background/80 backdrop-blur-md z-10 border-default-300 border-1 rounded-4xl overflow-clip'>
                    <Button
                        onPress={() => editor.chain().focus().toggleHighlightMark().run()}
                        variant={editor.isActive('highlightMark') ? 'shadow' : 'light'}
                        color={editor.isActive('highlightMark') ? 'warning' : 'default'}
                        isIconOnly
                        aria-label='标注重点词'
                    >
                        <PiHighlighterBold />
                    </Button>
                </ButtonGroup>
            </BubbleMenu>
            <article>
                <EditorContent editor={editor} />
            </article>
        </div>
    )
}
