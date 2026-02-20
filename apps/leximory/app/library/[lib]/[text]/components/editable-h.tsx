'use client'

import H from '@/components/ui/h'
import { useAtom, useAtomValue } from 'jotai'
import { isEditingAtom, titleAtom, emojiAtom } from '../atoms'
import { Input } from "@heroui/input"
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/popover"
import { resolveEmoji } from '@/lib/utils'
import EmojiPicker, { Theme } from 'emoji-picker-react'
import { useTheme } from 'next-themes'

export default function EditableH() {
    const [title, setTitle] = useAtom(titleAtom)
    const [emoji, setEmoji] = useAtom(emojiAtom)
    const isEditing = useAtomValue(isEditingAtom)
    const { resolvedTheme } = useTheme()

    if (!isEditing) {
        return <H fancy className={'sm:text-4xl mb-2 text-3xl print:text-5xl print:leading-none print:tracking-tighter'}>{title}</H>
    }

    return (
        <div className='flex flex-col items-center gap-3 w-full'>
            <Popover placement='bottom'>
                <PopoverTrigger>
                    <button
                        type='button'
                        className='text-5xl cursor-pointer transition-transform hover:scale-110 active:scale-95 rounded-2xl p-3'
                        aria-label='Pick an emoji'
                    >
                        {resolveEmoji(emoji, false)}
                    </button>
                </PopoverTrigger>
                <PopoverContent className='p-0 border-none bg-transparent shadow-none'>
                    <EmojiPicker
                        theme={resolvedTheme === 'dark' ? Theme.DARK : Theme.LIGHT}
                        onEmojiClick={(emojiData) => setEmoji(emojiData.emoji)}
                        lazyLoadEmojis
                    />
                </PopoverContent>
            </Popover>
            <Input value={title} onValueChange={setTitle} size='lg' classNames={{ input: 'text-center text-3xl' }} />
        </div>
    )
}
