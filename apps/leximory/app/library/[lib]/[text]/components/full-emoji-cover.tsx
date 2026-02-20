'use client'

import { useAtomValue } from 'jotai'
import { EmojiCover } from '../../components/text'
import { ebookAtom, emojiAtom, textAtom } from '../atoms'
import { cn, resolveEmoji } from '@/lib/utils'

export function TextEmojiCover({ className }: { className?: string }) {
    const emoji = useAtomValue(emojiAtom)
    const textId = useAtomValue(textAtom)
    const ebook = useAtomValue(ebookAtom)
    return (<EmojiCover
        emoji={resolveEmoji(emoji, !!ebook)}
        articleId={textId}
        className={cn('rounded-none', className)}
    />)
}
