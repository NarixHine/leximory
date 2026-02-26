'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import { Popover, PopoverTrigger, PopoverContent } from '@heroui/popover'
import { Textarea } from '@heroui/input'
import { Button } from '@heroui/button'
import { Spacer } from '@heroui/spacer'
import { useState } from 'react'
import type { NodeViewProps } from '@tiptap/react'
import { PiCheckCircle, PiPlusCircle, PiMinusCircle } from 'react-icons/pi'
import { cn } from '@/lib/utils'

const LABELS = ['原文形式', '词条', '释义', '语源', '同源词']

function CommentNodeView({ node, updateAttributes, selected }: NodeViewProps) {
    const portions = node.attrs.portions as string[]
    const [isOpen, setIsOpen] = useState(false)
    const [editing, setEditing] = useState<string[]>(portions)

    return (
        <NodeViewWrapper as='span' className='inline'>
            <Popover
                isOpen={isOpen}
                onOpenChange={(open) => {
                    setIsOpen(open)
                    if (open) setEditing([...portions])
                }}
                placement='top'
            >
                <PopoverTrigger>
                    <button
                        className={cn(
                            'text-inherit cursor-pointer',
                            selected && 'ring-2 ring-primary rounded-sm'
                        )}
                        style={{ fontStyle: 'inherit' }}
                    >
                        <span className='box-decoration-clone [box-shadow:inset_0_-0.5em_0_0_var(--tw-shadow-color)] shadow-default-300/70'>
                            {portions[0]}
                        </span>
                    </button>
                </PopoverTrigger>
                <PopoverContent className='max-w-80 bg-default-50 shadow-none border-7 border-default-200 rounded-4xl'>
                    <div className='py-3 px-2 space-y-2'>
                        {editing.map((portion, i) => (
                            <Textarea
                                key={`portion-${i}-${editing.length}`}
                                label={LABELS[i] ?? `字段 ${i + 1}`}
                                size='sm'
                                minRows={1}
                                value={portion}
                                onValueChange={(value) => {
                                    const newEditing = [...editing]
                                    newEditing[i] = value
                                    setEditing(newEditing)
                                }}
                            />
                        ))}
                        <div className='flex gap-1'>
                            {editing.length < 5 && (
                                <Button
                                    size='sm'
                                    variant='light'
                                    color='secondary'
                                    isIconOnly
                                    radius='full'
                                    onPress={() => setEditing([...editing, ''])}
                                >
                                    <PiPlusCircle className='size-4' />
                                </Button>
                            )}
                            {editing.length > 1 && (
                                <Button
                                    size='sm'
                                    variant='light'
                                    color='secondary'
                                    isIconOnly
                                    radius='full'
                                    onPress={() => setEditing(editing.slice(0, -1))}
                                >
                                    <PiMinusCircle className='size-4' />
                                </Button>
                            )}
                            <Button
                                size='sm'
                                color='primary'
                                className='rounded-4xl ml-auto'
                                startContent={<PiCheckCircle className='size-4' />}
                                onPress={() => {
                                    updateAttributes({ portions: editing.filter(Boolean) })
                                    setIsOpen(false)
                                }}
                                isIconOnly
                            />
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </NodeViewWrapper>
    )
}

export const CommentNode = Node.create({
    name: 'comment',
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,

    addAttributes() {
        return {
            portions: {
                default: [],
                parseHTML: (element: HTMLElement) => {
                    try {
                        return JSON.parse(decodeURIComponent(element.getAttribute('data-portions') || '[]'))
                    } catch {
                        return []
                    }
                },
                renderHTML: (attributes: Record<string, unknown>) => ({
                    'data-portions': encodeURIComponent(JSON.stringify(attributes.portions)),
                }),
            },
        }
    },

    parseHTML() {
        return [{ tag: 'lexi-comment' }]
    },

    renderHTML({ node, HTMLAttributes }) {
        return [
            'lexi-comment',
            mergeAttributes(HTMLAttributes),
            (node.attrs.portions as string[])[0] || '',
        ]
    },

    addNodeView() {
        return ReactNodeViewRenderer(CommentNodeView)
    },
})
