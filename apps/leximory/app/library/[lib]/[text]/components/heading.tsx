'use client'

import { useAtomValue } from 'jotai'
import { contentAtom, isFullViewportAtom } from '../atoms'
import EditableH from './editable-h'
import ShareButton from './share-button'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'
import { langAtom } from '../../atoms'
import { getLanguageStrategy } from '@/lib/languages/strategies'

export function ArticleHeading({ hideControls, isPublicAndFree, quoteInAgent }: {
    hideControls?: boolean,
    isPublicAndFree: boolean,
    quoteInAgent: ReactNode
}) {
    const lang = useAtomValue(langAtom)
    const { FormattedReadingTime } = getLanguageStrategy(lang)
    const isFullViewport = useAtomValue(isFullViewportAtom)
    const content = useAtomValue(contentAtom)
    return (<>
        <div className={cn(
            'flex items-center justify-center gap-3 print:mt-0 px-5 sm:w-5/6 mx-auto', isFullViewport && 'invisible',
            'transition-opacity duration-500 opacity-100',
            isFullViewport && 'opacity-0'
        )}>
            {hideControls ? <div className='invisible'><ShareButton isPublicAndFree={isPublicAndFree} className='mb-2' /></div> : quoteInAgent}
            <EditableH />
            <ShareButton isPublicAndFree={isPublicAndFree} className='mb-2 print:invisible' />
        </div>
        <div>
            {FormattedReadingTime && (
                <div className='text-sm text-center text-secondary-400 mb-2 text-balance px-4 md:hidden'>
                    {FormattedReadingTime(content)}
                </div>
            )}
        </div>
    </>)
}
