'use client'

import { Mark, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        convening: {
            toggleConvening: () => ReturnType
        }
    }
}

export const Convening = Mark.create({
    name: 'convening',

    parseHTML() {
        return [
            { tag: 'span.convening' },
        ]
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(HTMLAttributes, { class: 'convening' }), 0]
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
