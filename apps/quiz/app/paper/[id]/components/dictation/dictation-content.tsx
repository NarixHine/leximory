'use client'

import { useState } from 'react'
import { Button } from '@heroui/button'
import { Switch } from '@heroui/switch'
import { Card, CardBody, CardHeader } from '@heroui/card'
import { Spinner } from '@heroui/spinner'
import { TrashIcon, FloppyDiskIcon, ArrowsClockwiseIcon, CheckCircleIcon } from '@phosphor-icons/react'
import { ProtectedButton } from '@repo/ui/protected-button'
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { saveChunkNoteAction, deleteDictationAction, generateDictationAction, deleteDictationEntryAction } from '@repo/service/dictation'
import type { DictationContent as DictationContentType } from '@repo/schema/chunk-note'
import { SECTION_NAME_MAP } from '@repo/env/config'
import { cn } from '@heroui/theme'
import { useRouter } from 'next/navigation'

type DictationContentProps = {
    paperId: number
    dictation: {
        id: number
        content: DictationContentType
    } | null
    hasWriteAccess: boolean
}

export function DictationContent({ paperId, dictation, hasWriteAccess }: DictationContentProps) {
    const [showEnglish, setShowEnglish] = useState(false)
    const router = useRouter()

    const generateMutation = useMutation({
        mutationFn: async () => {
            await generateDictationAction({ paperId })
        },
        onSuccess: () => {
            router.refresh()
        },
        onError: () => {
            toast.error('生成失败')
        }
    })

    const deleteMutation = useMutation({
        mutationFn: async () => {
            if (!dictation) return
            await deleteDictationAction({
                paperId,
                dictationId: dictation.id
            })
        },
        onSuccess: () => {
            router.refresh()
            toast.success('已删除默写纸')
            generateMutation.reset()
        },
        onError: () => {
            toast.error('删除失败')
        },
    })

    // No dictation yet - show generate button
    if (!dictation) {
        if (generateMutation.isSuccess) {
            return (
                <div className='flex flex-col items-center justify-center py-16 gap-6'>
                    <Spinner size='lg' color='success' />
                    <div className='text-center'>
                        <h3 className='text-xl font-semibold mb-2'>默写纸已生成</h3>
                    </div>
                </div>
            )
        }

        return (
            <div className='flex flex-col items-center justify-center py-16 gap-6'>
                <div className='text-center'>
                    <h3 className='text-xl font-semibold mb-2'>还没有默写纸</h3>
                    <p className='text-default-500 text-sm'>
                        生成默写纸后，你可以练习中英文表达的对照记忆
                    </p>
                </div>
                {generateMutation.isPending ? (
                    <div className='flex flex-col items-center gap-3'>
                        <Spinner size='lg' />
                        <p className='text-default-500 text-sm'>
                            正在生成默写纸，可能需要半分钟……
                        </p>
                    </div>
                ) : (
                    <ProtectedButton
                        color='primary'
                        size='lg'
                        onPress={() => generateMutation.mutate()}
                        startContent={<ArrowsClockwiseIcon weight='bold' />}
                        label='登录后生成默写纸'
                    >
                        生成默写纸
                    </ProtectedButton>
                )}
            </div>
        )
    }

    return (
        <div className='space-y-6'>
            {/* Header with toggle and delete button */}
            <div className='flex items-center justify-between print:hidden'>
                <Switch
                    isSelected={showEnglish}
                    onValueChange={setShowEnglish}
                    size='sm'
                >
                    显示全部英文
                </Switch>
                {hasWriteAccess && (
                    <Button
                        size='sm'
                        variant='light'
                        color='danger'
                        startContent={<TrashIcon weight='duotone' />}
                        onPress={() => deleteMutation.mutate()}
                        isLoading={deleteMutation.isPending}
                    >
                        删除默写纸
                    </Button>
                )}
            </div>

            {/* Sections */}
            {dictation.content.sections.map((section, sectionIndex) => (
                <Card key={sectionIndex} shadow='none' className='bg-transparent p-0'>
                    <CardHeader className='px-0'>
                        <h3 className='text-lg font-semibold'>{SECTION_NAME_MAP[section.sectionType]}</h3>
                    </CardHeader>
                    <CardBody className='px-0 print:gap-2'>
                        {section.entries.map((entry) => {
                            const entryKey = `${sectionIndex}-${entry.chinese}-${entry.english}`
                            return (
                                <DictationEntry
                                    key={entryKey}
                                    entry={entry}
                                    showEnglish={showEnglish}
                                    paperId={paperId}
                                    dictationId={dictation.id}
                                    sectionIndex={sectionIndex}
                                    hasWriteAccess={hasWriteAccess}
                                />
                            )
                        })}
                    </CardBody>
                </Card>
            ))}
        </div>
    )
}

type DictationEntryProps = {
    entry: { english: string; chinese: string }
    showEnglish: boolean
    paperId: number
    dictationId: number
    sectionIndex: number
    hasWriteAccess: boolean
}

function DictationEntry({
    entry,
    showEnglish,
    paperId,
    dictationId,
    sectionIndex,
    hasWriteAccess
}: DictationEntryProps) {
    const { mutate: deleteEntry, isPending: isDeleting, isSuccess: isDeleted } = useMutation({
        mutationFn: async () => {
            const { data } = await deleteDictationEntryAction({
                paperId,
                dictationId,
                sectionIndex,
                entryEnglish: entry.english,
            })
            return data
        },
        onError: (error) => {
            toast.error(`删除失败：${error.message}`)
        },
    })

    return (
        <div className='flex justify-between gap-1'>
            <p className='text-default-700'>{entry.chinese}</p>
            <div className='flex items-center justify-end'>
                <p className={cn(
                    showEnglish ? 'text-foreground' : 'text-transparent underline-offset-6 underline decoration-foreground',
                    'font-medium mr-2 text-right'
                )}>
                    {entry.english}
                </p>
                <SaveEntryButton english={entry.english} chinese={entry.chinese} paperId={paperId} />
                {hasWriteAccess && (
                    <Button
                        size='sm'
                        variant='light'
                        color='danger'
                        className='print:hidden'
                        onPress={() => deleteEntry()}
                        isLoading={isDeleting}
                        isIconOnly
                        isDisabled={isDeleted}
                        startContent={isDeleted ? <CheckCircleIcon weight='duotone' /> : <TrashIcon weight='duotone' />}
                    />
                )}
            </div>
        </div>
    )
}

function SaveEntryButton({ english, chinese, paperId }: { english: string; chinese: string; paperId: number }) {
    const queryClient = useQueryClient()
    const { mutate: save, isPending, isSuccess } = useMutation({
        mutationKey: ['save-chunk-note', english, chinese],
        mutationFn: async ({ english, chinese }: { english: string; chinese: string }) => {
            const { data, serverError } = await saveChunkNoteAction({
                english,
                chinese,
                paperId
            })
            if (serverError) throw new Error(serverError)
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['all-notes'] })
        },
        onError: (error) => {
            toast.error(`保存失败：${error.message}`)
        },
    })

    return (
        <ProtectedButton
            size='sm'
            variant='light'
            color='primary'
            className='print:hidden'
            onPress={() => save({
                english,
                chinese
            })}
            isLoading={isPending}
            isDisabled={isSuccess}
            isIconOnly
            startContent={isSuccess ? <CheckCircleIcon weight='duotone' /> : <FloppyDiskIcon weight='duotone' />}
        />
    )
}
