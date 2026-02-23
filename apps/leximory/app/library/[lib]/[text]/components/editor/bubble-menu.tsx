'use client'

import { BubbleMenu } from '@tiptap/react/menus'
import type { Editor } from '@tiptap/react'
import { Button, ButtonGroup } from '@heroui/button'
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@heroui/dropdown'
import {
    PiTextBBold,
    PiTextItalicBold,
    PiTextHThreeBold,
    PiQuotesBold,
    PiListBulletsBold,
    PiHeadphonesBold,
    PiDotsThreeCircleBold,
    PiTextHTwoBold,
    PiTextStrikethroughBold,
    PiListNumbersBold,
    PiCodeBold,
} from 'react-icons/pi'
import { nanoid } from '@/lib/utils'

export default function EditorBubbleMenu({ editor }: { editor: Editor }) {
    return (
        <BubbleMenu
            editor={editor}
            pluginKey='bubbleMenuMain'
            updateDelay={250}
            options={{
                placement: 'top',
                flip: true,
                offset: 10,
                strategy: 'absolute',
            }}
            shouldShow={({ editor, state }) => {
                return !state.selection.empty && editor.isEditable
            }}
        >
            <div className='flex items-center gap-1'>
                <ButtonGroup className='bg-background/50 backdrop-blur-md z-10 shadow-medium rounded-xl overflow-clip'>
                    <Button
                        onPress={() => editor.chain().focus().toggleBold().run()}
                        variant={editor.isActive('bold') ? 'shadow' : 'light'}
                        isIconOnly
                        size='sm'
                        aria-label='Bold'
                    >
                        <PiTextBBold />
                    </Button>
                    <Button
                        onPress={() => editor.chain().focus().toggleItalic().run()}
                        variant={editor.isActive('italic') ? 'shadow' : 'light'}
                        isIconOnly
                        size='sm'
                        aria-label='Italic'
                    >
                        <PiTextItalicBold />
                    </Button>
                    <Button
                        onPress={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                        variant={editor.isActive('heading', { level: 3 }) ? 'shadow' : 'light'}
                        isIconOnly
                        size='sm'
                        aria-label='Heading 3'
                    >
                        <PiTextHThreeBold />
                    </Button>
                    <Button
                        onPress={() => editor.chain().focus().toggleBlockquote().run()}
                        variant={editor.isActive('blockquote') ? 'shadow' : 'light'}
                        isIconOnly
                        size='sm'
                        aria-label='Blockquote'
                    >
                        <PiQuotesBold />
                    </Button>
                    <Button
                        onPress={() => editor.chain().focus().toggleBulletList().run()}
                        variant={editor.isActive('bulletList') ? 'shadow' : 'light'}
                        isIconOnly
                        size='sm'
                        aria-label='Bullet List'
                    >
                        <PiListBulletsBold />
                    </Button>
                    {editor.isActive('audioSection') ? (
                        <Button
                            onPress={() => editor.chain().focus().removeAudioSection().run()}
                            variant='shadow'
                            color='danger'
                            isIconOnly
                            size='sm'
                            aria-label='Remove Audio'
                        >
                            <PiHeadphonesBold />
                        </Button>
                    ) : (
                        <Button
                            onPress={() =>
                                editor.chain().focus().setAudioSection({ id: nanoid() }).run()
                            }
                            variant='light'
                            isIconOnly
                            size='sm'
                            aria-label='Audio Section'
                        >
                            <PiHeadphonesBold />
                        </Button>
                    )}
                </ButtonGroup>
                <Dropdown>
                    <DropdownTrigger className='bg-transparent'>
                        <Button
                            variant='light'
                            isIconOnly
                            size='sm'
                            aria-label='More options'
                            className='bg-background/50 backdrop-blur shadow-medium rounded-xl'
                        >
                            <PiDotsThreeCircleBold />
                        </Button>
                    </DropdownTrigger>
                    <DropdownMenu>
                        <DropdownItem
                            key='h2'
                            startContent={<PiTextHTwoBold />}
                            onPress={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        >
                            Heading 2
                        </DropdownItem>
                        <DropdownItem
                            key='strikethrough'
                            startContent={<PiTextStrikethroughBold />}
                            onPress={() => editor.chain().focus().toggleStrike().run()}
                        >
                            Strikethrough
                        </DropdownItem>
                        <DropdownItem
                            key='ordered-list'
                            startContent={<PiListNumbersBold />}
                            onPress={() => editor.chain().focus().toggleOrderedList().run()}
                        >
                            Ordered List
                        </DropdownItem>
                        <DropdownItem
                            key='code-block'
                            startContent={<PiCodeBold />}
                            onPress={() => editor.chain().focus().toggleCodeBlock().run()}
                        >
                            Code Block
                        </DropdownItem>
                    </DropdownMenu>
                </Dropdown>
            </div>
        </BubbleMenu>
    )
}
