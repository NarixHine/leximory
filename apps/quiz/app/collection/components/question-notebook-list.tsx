'use client'

import { QuestionNoteCard } from '@repo/ui/question-note'
import { ChunkNoteCard } from '@repo/ui/chunk-note'
import { getAllNotesAction, deleteNoteAction } from '@repo/service/question-note'
import { Spinner } from '@heroui/spinner'
import { Button } from '@heroui/button'
import { Chip } from '@heroui/chip'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useIntersectionObserver } from 'usehooks-ts'
import { Logo } from '@/components/logo'
import { CheckCircleIcon, TrashIcon } from '@phosphor-icons/react'
import { startTransition } from 'react'

type NoteData = {
    notes: Array<{ content: string, id: number, date: string, relatedPaper: number | null, type: 'question' | 'chunk' }>
    cursor: string
    more: boolean
}

export function NotebookList({ initialData }: { initialData: NoteData | undefined }) {
    const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
        queryKey: ['all-notes'],
        queryFn: async ({ pageParam }) => {
            const result = await getAllNotesAction({ cursor: pageParam })
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

    const allNotes = data.pages.flatMap(page => page?.notes ?? [])

    if (allNotes.length === 0) {
        return (
            <div className='col-span-full text-center py-12'>
                <Logo className='mx-auto mb-4 size-20' />
                <p className='text-primary'>还没有收录任何笔记</p>
                <p className='text-sm mt-1 text-default-400'>做完试卷后点击「收录题目」或在默写纸中保存表达</p>
            </div>
        )
    }

    return (
        <>
            {allNotes.map(({ content, id, date, type }) => (
                <div key={id} className='rounded-sm border border-divider'>
                    <div className='px-4 py-2 border-b border-divider flex justify-between items-center'>
                        <div className='flex items-center gap-2'>
                            <span className='text-xs text-default-500 font-mono'>{date}</span>
                            <Chip size='sm' variant='flat' color={type === 'question' ? 'secondary' : 'warning'}>
                                {type === 'question' ? '题目' : '表达'}
                            </Chip>
                        </div>
                        <div className='flex items-center gap-2'>
                            <DeleteButton noteId={id} />
                            <Logo className='size-5 grayscale-75 opacity-80' />
                        </div>
                    </div>
                    {type === 'question' ? (
                        <QuestionNoteCard content={content} className='bg-transparent' cardBodyClassName='px-4 py-3' />
                    ) : (
                        <ChunkNoteCard content={content} className='bg-transparent' cardBodyClassName='px-4 py-3' />
                    )}
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

function DeleteButton({ noteId }: { noteId: number }) {
    const queryClient = useQueryClient()
    const deleteMutation = useMutation({
        mutationKey: ['delete-note', noteId],
        mutationFn: async (id: number) => {
            await deleteNoteAction({ id })
        },
        onSuccess: () => {
            startTransition(() => {
                queryClient.invalidateQueries({ queryKey: ['all-notes'] })
            })
        },
    })

    return (
        <Button
            size='sm'
            className='size-5'
            variant='light'
            isIconOnly
            onPress={() => deleteMutation.mutate(noteId)}
            isLoading={deleteMutation.isPending && deleteMutation.variables === noteId}
            isDisabled={deleteMutation.isSuccess}
            startContent={deleteMutation.isSuccess ? <CheckCircleIcon weight='duotone' size={16} /> : <TrashIcon weight='duotone' size={16} />}
        />
    )
}   
