'use client'

import { LeftCard, HeroCard, RightCard, CompactCard, AddTextButton } from '../text'

type TextData = {
    id: string
    title: string
    topics: string[]
    emoji: string | null
    hasEbook: boolean
    createdAt: string
}

/** Renders a vertical rule between grid columns using CSS column separators. */
function CompactCardWithDivider({ article, isLast }: { article: TextData, isLast: boolean }) {
    return (
        <div className={isLast ? '' : 'border-r border-default-200/60 pr-6'}>
            <CompactCard {...article} />
        </div>
    )
}

export default function TextList({ texts, isReadOnly }: { texts: TextData[], isReadOnly: boolean }) {
    if (texts.length === 0) {
        return (
            <div className='flex flex-col items-center gap-6 py-16'>
                {!isReadOnly && <AddTextButton />}
                <p className='text-default-400 text-sm'>暂无文章</p>
            </div>
        )
    }

    // Split articles: first few for hero, rest for grid
    const heroArticle = texts[0]!
    const leftArticles = texts.slice(1, 3)
    const rightArticles = texts.slice(3, 7)
    const moreArticles = texts.slice(7)

    return (
        <>
            {/* Mobile layout: single column */}
            <div className='mx-auto max-w-md md:hidden'>
                <div className='flex flex-col gap-8'>
                    {!isReadOnly && <AddTextButton />}
                    <LeftCard {...heroArticle} />
                    {leftArticles.map((a) => (
                        <LeftCard key={a.id} {...a} />
                    ))}
                    {rightArticles.map((a) => (
                        <LeftCard key={a.id} {...a} />
                    ))}
                    {moreArticles.map((a) => (
                        <CompactCard key={a.id} {...a} />
                    ))}
                </div>
            </div>

            {/* Tablet layout (md): Hero left, compact articles right */}
            <div className='mx-auto hidden max-w-4xl md:block lg:hidden'>
                <div className='grid grid-cols-[1.2fr_1fr] gap-8'>
                    {/* Left: Hero article */}
                    <div className='flex flex-col gap-6'>
                        <HeroCard {...heroArticle} />
                    </div>

                    {/* Right: Compact stacked articles */}
                    <div className='flex flex-col gap-6'>
                        {rightArticles.map((article) => (
                            <RightCard key={article.id} {...article} />
                        ))}
                        {!isReadOnly && <AddTextButton />}
                    </div>
                </div>

                {/* Additional articles below in 2 columns with vertical rules */}
                {(leftArticles.length > 0 || moreArticles.length > 0) && (
                    <div className='mt-12 grid grid-cols-2 gap-x-8 gap-y-8'>
                        {[...leftArticles, ...moreArticles].map((article, i, arr) => (
                            <CompactCardWithDivider key={article.id} article={article} isLast={i % 2 === 1} />
                        ))}
                    </div>
                )}
            </div>

            {/* Desktop layout (lg+): 3-column Atlantic grid */}
            <div className='mx-auto hidden max-w-6xl lg:block'>
                <div className='grid grid-cols-[1fr_2fr_1fr] gap-8 xl:gap-10'>
                    {/* Left column */}
                    <div className='flex flex-col gap-10'>
                        {leftArticles.map((article) => (
                            <LeftCard key={article.id} {...article} />
                        ))}
                    </div>

                    {/* Center column */}
                    <div className='border-default-200/80 border-x px-8 xl:px-10'>
                        <HeroCard {...heroArticle} />
                    </div>

                    {/* Right column */}
                    <div className='flex flex-col gap-6'>
                        {rightArticles.map((article) => (
                            <div key={article.id}>
                                <RightCard {...article} />
                            </div>
                        ))}
                        {!isReadOnly && <AddTextButton />}
                    </div>
                </div>

                {/* Additional articles below in 3 columns with vertical rules */}
                {moreArticles.length > 0 && (
                    <div className='mt-16 grid grid-cols-3 gap-x-6 gap-y-10'>
                        {moreArticles.map((article, i, arr) => (
                            <CompactCardWithDivider key={article.id} article={article} isLast={i % 3 === 2} />
                        ))}
                    </div>
                )}
            </div>
        </>
    )
}
