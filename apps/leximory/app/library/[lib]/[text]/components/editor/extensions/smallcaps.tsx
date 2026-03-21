'use client'

import { Mark, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        smallcaps: {
            toggleConvening: () => ReturnType
        }
    }
}

export const SmallCaps = Mark.create({
    name: 'smallcaps',

    parseHTML() {
        return [
            { tag: 'span.smallcaps' },
        ]
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(HTMLAttributes, { class: 'smallcaps' }), 0]
    },

    addCommands() {
        return {
            toggleConvening:
                () =>
                ({ commands }) => {
                    return commands.toggleMark(this.name)
                },
        }
    },
})
