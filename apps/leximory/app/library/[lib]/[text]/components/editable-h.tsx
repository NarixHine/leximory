'use client'

import H from '@/components/ui/h'
import { useAtom, useAtomValue } from 'jotai'
import { isEditingAtom, titleAtom, emojiAtom } from '../atoms'
import { Input } from "@heroui/input"
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/popover"
import { resolveEmoji, isValidEmoji } from '@/lib/utils'
import EmojiPicker, { Theme } from 'emoji-picker-react'
import { useTheme } from 'next-themes'
import { useState } from 'react'

export default function EditableH() {
    const [title, setTitle] = useAtom(titleAtom)
    const [emoji, setEmoji] = useAtom(emojiAtom)
    const isEditing = useAtomValue(isEditingAtom)
    const { resolvedTheme } = useTheme()
    const [manualInput, setManualInput] = useState('')

    if (!isEditing) {
        return <H fancy className={'sm:text-4xl mb-2 text-3xl print:text-5xl print:leading-none print:tracking-tighter'}>{title}</H>
    }

    const handleManualInput = (value: string) => {
        setManualInput(value)
        if (value && isValidEmoji(value)) {
            setEmoji(value)
        }
    }

    return (
        <div className='flex flex-col items-center gap-3 w-full'>
            <div className='flex items-center gap-3'>
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
                            onEmojiClick={(emojiData) => {
                                setEmoji(emojiData.emoji)
                                setManualInput('')
                            }}
                            lazyLoadEmojis
                        />
                    </PopoverContent>
                </Popover>
                <Input
                    value={manualInput}
                    onValueChange={handleManualInput}
                    placeholder='Paste emoji'
                    size='sm'
                    maxLength={16}
                    className='w-24'
                    classNames={{ input: 'text-center text-lg' }}
                    isInvalid={manualInput.length > 0 && !isValidEmoji(manualInput)}
                    aria-label='Manual emoji input'
                />
            </div>
            <Input value={title} onValueChange={setTitle} size='lg' classNames={{ input: 'text-center text-3xl' }} />
        </div>
    )
}
