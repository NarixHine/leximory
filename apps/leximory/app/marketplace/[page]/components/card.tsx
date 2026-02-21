'use client'

import { Lang } from '@repo/env/config'
import BuyLibrary from '@/components/buy-library'
import LibraryCardBase from '@/components/library-card'

interface LibraryCardProps {
    library: {
        id: string
        owner: string
        name: string
        lang: Lang
        price: number
        readers?: number
    }
    isStarred: boolean
    hideFooter?: boolean
    isOwner: boolean
}

export default function LibraryCard({ library, isStarred, hideFooter, isOwner }: LibraryCardProps) {
    return (
        <LibraryCardBase
            id={library.id}
            name={library.name}
            lang={library.lang}
            footer={!hideFooter ? <>
                {typeof library.readers === 'number' ? (
                    <div className='text-default-400 text-xs'>
                        <span className='font-mono text-sm'>{library.readers}</span> 个读者
                    </div>
                ) : <div />}
                <BuyLibrary
                    isStarred={isStarred}
                    id={library.id}
                    price={library.price}
                    uid={library.owner}
                    isOwner={isOwner}
                    color='default'
                />
            </> : undefined}
        />
    )
}
