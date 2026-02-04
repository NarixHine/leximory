'use client'

import { QuestionNoteCard } from '@repo/ui/question-note'
import { getRecentQuestionNotesAction } from '@repo/service/question-note'
import { Spinner } from '@heroui/spinner'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useIntersectionObserver } from 'usehooks-ts'
import { Logo } from '@/components/logo'

type QuestionNoteData = {
    notes: Array<{ content: string, id: number, date: string, relatedPaper: number | null }>
    cursor: string
    more: boolean
}

export function QuestionNotebookList({ initialData }: { initialData: QuestionNoteData | undefined }) {
    const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
        queryKey: ['recent-question-notes'],
        queryFn: async ({ pageParam }) => {
            const result = await getRecentQuestionNotesAction({ cursor: pageParam })
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

    const allNotes = data?.pages.flatMap(page => page?.notes ?? []) ?? []

    if (allNotes.length === 0) {
        return (
            <div className='col-span-full text-center text-default-400 py-12'>
                <p>还没有收录任何题目</p>
                <p className='text-sm mt-1'>做完试卷后点击「收录题目」即可添加</p>
            </div>
        )
    }

    return (
        <>
            {allNotes.map(({ content, id, date }) => (
                <div key={id} className='rounded-sm border border-divider'>
                    <div className='px-4 py-2 border-b border-divider flex justify-between items-center'>
                        <span className='text-xs text-default-500 font-mono'>{date}</span>
                        <Logo className='size-5 grayscale-75 opacity-80' />
                    </div>
                    <QuestionNoteCard content={content} className='bg-transparent' cardBodyClassName='px-4 py-3' />
                </div>
            ))}
            {hasNextPage && (
                <div ref={ref} className='col-span-full flex justify-center py-4'>
                    {isFetchingNextPage ? <Spinner size='sm' /> : null}
                </div>
            )}
        </>
    )
}
