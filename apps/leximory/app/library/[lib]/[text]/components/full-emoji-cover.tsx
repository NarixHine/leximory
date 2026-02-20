'use client'

import { useAtomValue } from 'jotai'
import { EmojiCover } from '../../components/text'
import { ebookAtom, emojiAtom, textAtom } from '../atoms'
import { resolveEmoji } from '@/lib/utils'

export function FullEmojiCover() {
    const emoji = useAtomValue(emojiAtom)
    const textId = useAtomValue(textAtom)
    const ebook = useAtomValue(ebookAtom)
    return (<EmojiCover
        emoji={resolveEmoji(emoji, !!ebook)}
        articleId={textId}
        className='w-full h-full rounded-2xl'
    />)
}
