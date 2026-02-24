'use client'

import { getLanguageStrategy } from '@/lib/languages'
import { Lang } from '@repo/schema/library'
import { DateTime } from 'luxon'
import { TagPills } from '../../components/text'
import { BackwardButton } from './backward-button'
import { TextEmojiCover } from './full-emoji-cover'
import { useAtomValue } from 'jotai'
import { isFullViewportAtom } from '../atoms'
import { cn } from '@/lib/utils'
import { commentSyntaxRegex } from '@repo/utils'

/** Magazine-style article hero header. */
export function ArticleHero({ title, topics, createdAt, libId, lang, content, hasEbook }: {
    title: string, topics: string[], createdAt: string | null, libId: string, lang: Lang, content: string, hasEbook: boolean
}) {
    const isFullViewport = useAtomValue(isFullViewportAtom)
    const { FormattedReadingTime } = getLanguageStrategy(lang)
    const dateStr = createdAt ? DateTime.fromISO(createdAt).toFormat('MMMM dd, yyyy') : null

    return (<>
        <div className={cn('print:hidden hidden md:block w-full opacity-100 transition-opacity duration-500', isFullViewport && 'opacity-0')}>
            {/* md+ layout: side-by-side, emoji on right, text on left */}
            <div className='hidden md:grid md:grid-cols-[1fr_1fr] md:gap-12 md:min-h-dvh md:items-center md:mb-12'>
                <div className='flex flex-col max-w-[calc(40dvw)] mx-auto self-end pb-15'>
                    <BackwardButton libId={libId} className='mb-5 -ml-3' />
                    {dateStr && <time className='block text-lg text-secondary-400 mb-4'>{dateStr}</time>}
                    <h1 className='font-fancy uppercase text-4xl leading-tight tracking-tight text-foreground text-balance mb-4'>
                        {title}
                    </h1>
                    {FormattedReadingTime && !hasEbook && (
                        <div className='text-sm mb-4'>
                            {FormattedReadingTime(content)}
                        </div>
                    )}
                    <TagPills tags={topics} size='md' color='secondary' className='text-sm text-secondary-400 border-1 border-secondary-300' classNames={{ content: 'px-1.25' }} />
                </div>
                <TextEmojiCover className='w-full h-full' />
            </div>
        </div>

        {/* Mobile layout: vertical stack */}
        <div className={cn('print:hidden md:hidden w-full mb-8 transition-opacity duration-2000', isFullViewport && 'invisible')}>
            <BackwardButton libId={libId} className='mb-3 ml-5' />
            <TextEmojiCover className='w-full h-64' />
            <div className='flex justify-center my-3'>
                <TagPills tags={topics} size='md' color='secondary' className='text-sm text-secondary-400 border-1 border-secondary-300' classNames={{ content: 'px-1.25' }} />
            </div>
        </div>
    </>)
}
