'use client'

import { Mark, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        highlightMark: {
            toggleHighlightMark: () => ReturnType
        }
    }
}

export const HighlightMark = Mark.create({
    name: 'highlightMark',

    parseHTML() {
        return [
            { tag: 'mark' },
        ]
    },

    renderHTML({ HTMLAttributes }) {
        return ['mark', mergeAttributes(HTMLAttributes, { class: 'bg-warning-200 dark:bg-warning-100/30 rounded-sm px-0.5' }), 0]
    },

    addCommands() {
        return {
            toggleHighlightMark:
                () =>
                ({ commands }) => {
                    return commands.toggleMark(this.name)
                },
        }
    },
})
