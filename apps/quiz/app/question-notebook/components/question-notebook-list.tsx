'use client'

import { QuestionNoteCard } from '@repo/ui/question-note'
import { getRecentQuestionNotesAction, deleteQuestionNoteAction } from '@repo/service/question-note'
import { Spinner } from '@heroui/spinner'
import { Button } from '@heroui/button'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useIntersectionObserver } from 'usehooks-ts'
import { Logo } from '@/components/logo'
import { TrashIcon } from '@phosphor-icons/react'
import { toast } from 'sonner'

type QuestionNoteData = {
    notes: Array<{ content: string, id: number, date: string, relatedPaper: number | null }>
    cursor: string
    more: boolean
}

export function QuestionNotebookList({ initialData }: { initialData: QuestionNoteData | undefined }) {
    const queryClient = useQueryClient()
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

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const { data, serverError } = await deleteQuestionNoteAction({ id })
            if (serverError) {
                throw new Error(serverError)
            }
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['recent-question-notes'] })
        },
    })

    const handleDelete = (id: number) => {
        toast.promise(
            deleteMutation.mutateAsync(id),
            {
                loading: '正在删除……',
                success: '已删除',
                error: (err) => `删除失败：${err.message}`,
            }
        )
    }

    const allNotes = data.pages.flatMap(page => page?.notes ?? []) ?? []

    if (allNotes.length === 0) {
        return (
            <div className='col-span-full text-center text-default-400 py-12'>
                <Logo className='mx-auto mb-4 size-20' />
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
                        <div className='flex items-center gap-2'>
                            <Button
                                size='sm'
                                className='size-5'
                                variant='light'
                                isIconOnly
                                onPress={() => handleDelete(id)}
                                isLoading={deleteMutation.isPending && deleteMutation.variables === id}
                                startContent={<TrashIcon weight='duotone' size={16} />}
                            />
                            <Logo className='size-5 grayscale-75 opacity-80' />
                        </div>
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
