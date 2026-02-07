'use client'

import { WordNote } from '@repo/ui/word-note'
import { getRecentWordsAction } from '@repo/service/word'
import { Spinner } from '@heroui/spinner'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useIntersectionObserver } from 'usehooks-ts'
import { parseWord } from '@repo/utils'
import { Logo } from '@/components/logo'

export function NotebookList({ initialData }: { initialData: { words: Array<{ word: string, id: string, date: string }>, cursor: string, more: boolean } | undefined }) {
    const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
        queryKey: ['recent-words'],
        queryFn: async ({ pageParam }) => {
            const result = await getRecentWordsAction({ cursor: pageParam })
            return result.data
        },
        initialPageParam: '0',
        initialData: initialData ? { pages: [initialData], pageParams: ['0'] } : undefined,
        getNextPageParam: (lastPage) => lastPage?.more ? lastPage.cursor : undefined,
    })

    const { ref } = useIntersectionObserver({
        threshold: 0.1,
        onChange: (isIntersecting) => {
            if (isIntersecting && hasNextPage && !isFetchingNextPage) {
                fetchNextPage()
            }
        },
    })

    const allWords = data.pages.flatMap(page => page?.words ?? []) ?? []

    if (allWords.length === 0) {
        return (
            <div className='col-span-full text-center py-12'>
                <Logo className='mx-auto mb-4 size-20' />
                <p className='text-primary'>还没有收录任何生词</p>
                <p className='text-sm mt-1 text-default-400'>做完试卷后选中词汇点击「Define」按钮进行释义</p>
            </div>
        )
    }

    return (
        <>
            {allWords.map(({ word, id, date }) => {
                const portions = parseWord(word)
                return (
                    <div key={id} className='rounded-sm border border-divider'>
                        <div className='px-4 py-2 border-b border-divider flex justify-between items-center'>
                            <span className='text-xs text-default-500 font-mono'>{date}</span>
                            <Logo className='size-5 grayscale-75 opacity-80' />
                        </div>
                        <WordNote portions={portions} className='bg-transparent' cardBodyClassName='px-4 py-3' />
                    </div>
                )
            })}
            {hasNextPage && (
                <div ref={ref} className='col-span-full flex justify-center py-4'>
                    {isFetchingNextPage ? <Spinner size='sm' /> : null}
                </div>
            )}
        </>
    )
}
