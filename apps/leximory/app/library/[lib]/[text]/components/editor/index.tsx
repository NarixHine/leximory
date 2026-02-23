'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import { CommentNode } from './extensions/comment-node'
import { AudioSection } from './extensions/audio-section'
import EditorBubbleMenu from './bubble-menu'
import { markdownToHtml, getMarkdownFromEditor } from './serialization'
import { useRef } from 'react'
import { cn } from '@/lib/utils'

interface LeximoryEditorProps {
    value: string
    onChange: (markdown: string) => void
    className?: string
}

export default function LeximoryEditor({ value, onChange, className }: LeximoryEditorProps) {
    const initialHtml = useRef(markdownToHtml(value))

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                link: false,
            }),
            Markdown.configure({
                html: true,
                transformPastedText: true,
                transformCopiedText: true,
            }),
            CommentNode,
            AudioSection,
        ],
        content: initialHtml.current,
        editorProps: {
            attributes: {
                class: cn(
                    'focus:outline-none prose dark:prose-invert',
                    'prose-blockquote:not-italic prose-blockquote:border-default! prose-blockquote:border-l-2! prose-blockquote:text-foreground',
                    'prose-hr:my-8',
                    'prose-em:font-light',
                    'prose-code:before:content-["["] prose-code:after:content-["]"] prose-code:font-medium',
                    '[&_pre_code]:before:content-none [&_pre_code]:after:content-none prose-pre:bg-stone-600 prose-pre:border-stone-600',
                    'font-formal min-h-40',
                    className
                ),
            },
        },
        editable: true,
        immediatelyRender: false,
        shouldRerenderOnTransaction: true,
        onUpdate: ({ editor }) => {
            onChange(getMarkdownFromEditor(editor))
        },
    })

    if (!editor) return null

    return (
        <div className='w-full'>
            <EditorBubbleMenu editor={editor} />
            <EditorContent editor={editor} />
        </div>
    )
}
