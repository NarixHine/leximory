'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import { PiHeadphones, PiXCircle } from 'react-icons/pi'
import { Button } from '@heroui/button'
import type { NodeViewProps } from '@tiptap/react'

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        audioSection: {
            setAudioSection: (attributes: { id: string }) => ReturnType
            removeAudioSection: () => ReturnType
        }
    }
}

function AudioSectionView({ editor }: NodeViewProps) {
    return (
        <NodeViewWrapper className='border-l-3 border-primary/50 pl-4 my-4 relative group'>
            <div className='flex items-center gap-1.5 mb-1'>
                <PiHeadphones className='size-4 text-primary/50' />
                <span className='text-xs font-mono text-primary/50'>Audio</span>
                <Button
                    isIconOnly
                    size='sm'
                    variant='light'
                    color='danger'
                    className='opacity-0 group-hover:opacity-100 transition-opacity ml-auto'
                    onPress={() => {
                        editor.chain().focus().removeAudioSection().run()
                    }}
                >
                    <PiXCircle className='size-4' />
                </Button>
            </div>
            <NodeViewContent />
        </NodeViewWrapper>
    )
}

export const AudioSection = Node.create({
    name: 'audioSection',
    group: 'block',
    content: 'block+',
    defining: true,

    addAttributes() {
        return {
            id: {
                default: '',
                parseHTML: (element: HTMLElement) => element.getAttribute('data-id'),
                renderHTML: (attributes: Record<string, unknown>) => ({
                    'data-id': attributes.id,
                }),
            },
        }
    },

    parseHTML() {
        return [{ tag: 'lexi-audio' }]
    },

    renderHTML({ HTMLAttributes }) {
        return ['lexi-audio', mergeAttributes(HTMLAttributes), 0]
    },

    addNodeView() {
        return ReactNodeViewRenderer(AudioSectionView)
    },

    addCommands() {
        return {
            setAudioSection:
                (attributes) =>
                    ({ commands }) => {
                        return commands.wrapIn(this.name, attributes)
                    },
            removeAudioSection:
                () =>
                    ({ commands }) => {
                        return commands.lift(this.name)
                    },
        }
    },
})
