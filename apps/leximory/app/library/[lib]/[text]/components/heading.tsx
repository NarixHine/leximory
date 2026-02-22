'use client'

import { useAtomValue } from 'jotai'
import { isFullViewportAtom } from '../atoms'
import EditableH from './editable-h'
import ShareButton from './share-button'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

export function ArticleHeading({ hideControls, isPublicAndFree, quoteInAgent }: {
    hideControls?: boolean,
    isPublicAndFree: boolean,
    quoteInAgent: ReactNode
}) {
    const isFullViewport = useAtomValue(isFullViewportAtom)
    return (<div className={cn(
        'flex items-center justify-center gap-3 print:mt-0 px-5 sm:w-5/6 mx-auto', isFullViewport && 'invisible',
        'transition-opacity duration-500 opacity-100',
        isFullViewport && 'opacity-0'
    )}>
        {hideControls ? <div className='invisible'><ShareButton isPublicAndFree={isPublicAndFree} className='mb-2' /></div> : quoteInAgent}
        <EditableH />
        <ShareButton isPublicAndFree={isPublicAndFree} className='mb-2 print:invisible' />
    </div>)
}
