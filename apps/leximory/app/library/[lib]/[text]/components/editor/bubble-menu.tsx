'use client'

import { BubbleMenu } from '@tiptap/react/menus'
import type { Editor } from '@tiptap/react'
import { Button, ButtonGroup } from '@heroui/button'
import {
    PiTextBBold,
    PiTextItalicBold,
    PiQuotesBold,
    PiListBulletsBold,
    PiHeadphonesBold,
    PiTextHBold,
    PiTextAaBold,
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
                <ButtonGroup radius='full' className='bg-background/80 backdrop-blur-md z-10 border-default-300 border-1 rounded-4xl overflow-clip'>
                    <Button
                        onPress={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        variant={editor.isActive('heading') ? 'shadow' : 'light'}
                        isIconOnly
                        aria-label='Heading'
                    >
                        <PiTextHBold />
                    </Button>
                    <Button
                        onPress={() => editor.chain().focus().toggleBold().run()}
                        variant={editor.isActive('bold') ? 'shadow' : 'light'}
                        isIconOnly
                        aria-label='Bold'
                    >
                        <PiTextBBold />
                    </Button>
                    <Button
                        onPress={() => editor.chain().focus().toggleItalic().run()}
                        variant={editor.isActive('italic') ? 'shadow' : 'light'}
                        isIconOnly
                        aria-label='Italic'
                    >
                        <PiTextItalicBold />
                    </Button>
                    <Button
                        onPress={() => editor.chain().focus().toggleBlockquote().run()}
                        variant={editor.isActive('blockquote') ? 'shadow' : 'light'}
                        isIconOnly
                        aria-label='Blockquote'
                    >
                        <PiQuotesBold />
                    </Button>
                    <Button
                        onPress={() => editor.chain().focus().toggleBulletList().run()}
                        variant={editor.isActive('bulletList') ? 'shadow' : 'light'}
                        isIconOnly
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
                            aria-label='Audio Section'
                        >
                            <PiHeadphonesBold />
                        </Button>
                    )}
                    <Button
                        onPress={() => editor.chain().focus().toggleConvening().run()}
                        variant={editor.isActive('convening') ? 'shadow' : 'light'}
                        isIconOnly
                        aria-label='Convening'
                    >
                        <PiTextAaBold />
                    </Button>
                </ButtonGroup>
            </div>
        </BubbleMenu>
    )
}
