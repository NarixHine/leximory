'use client'

import { getLanguageStrategy } from '@/lib/languages'
import { Lang } from '@repo/schema/library'
import { TagPills } from '../../components/text'
import { BackwardButton } from './backward-button'
import { TextEmojiCover } from './full-emoji-cover'
import { useAtomValue } from 'jotai'
import { isFullViewportAtom } from '../atoms'
import { cn } from '@/lib/utils'

/** Magazine-style article hero header. */
export function ArticleHero({ title, topics, libId, lang, content, hasEbook }: {
    title: string, topics: string[], createdAt: string | null, libId: string, lang: Lang, content: string, hasEbook: boolean
}) {
    const isFullViewport = useAtomValue(isFullViewportAtom)
    const { FormattedReadingTime } = getLanguageStrategy(lang)
    return (<>
        <div className={cn('print:hidden hidden md:flex md:flex-col w-full opacity-100 transition-opacity duration-500', isFullViewport && 'opacity-0')}>
            {/* md+ layout: side-by-side, emoji on right, text on left */}
            <div className='grid grid-cols-[1fr_1fr] gap-12 min-h-dvh items-center'>
                <div className='flex flex-col max-w-[calc(40dvw)] mx-auto self-end pb-11'>
                    <BackwardButton libId={libId} className='mb-5 -ml-3' />
                    <h1 className='font-fancy uppercase text-4xl leading-tighter tracking-wide text-foreground text-balance mb-5'>
                        {title}
                    </h1>
                    {FormattedReadingTime && !hasEbook && (
                        <div className='font-mono text-primary-500'>
                            {FormattedReadingTime(content)}
                        </div>
                    )}
                    <TagPills parentClassName='gap-3' tags={topics} size='md' color='primary' variant='light' className='text-sm text-primary-600 px-0' classNames={{ content: 'px-0' }} />
                </div>
                <TextEmojiCover className='w-full h-full' />
            </div>
            <div className='w-[calc(50%+24px)] h-px block -mt-px mb-10 bg-foreground' />
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
