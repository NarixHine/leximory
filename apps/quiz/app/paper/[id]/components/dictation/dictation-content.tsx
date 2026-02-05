'use client'

import { useState } from 'react'
import { Button } from '@heroui/button'
import { Switch } from '@heroui/switch'
import { Card, CardBody, CardHeader } from '@heroui/card'
import { Spinner } from '@heroui/spinner'
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from '@heroui/table'
import { TrashIcon, EyeIcon, FloppyDiskIcon, ArrowsClockwiseIcon } from '@phosphor-icons/react'
import { ProtectedButton } from '@repo/ui/protected-button'
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { saveChunkNoteAction, deleteDictationAction, generateDictationAction } from '@repo/service/dictation'
import type { DictationContent as DictationContentType } from '@repo/schema/chunk-note'
import { useUser } from '@repo/ui/auth'
import { SECTION_NAME_MAP } from '@repo/env/config'

type DictationContentProps = {
    paperId: number
    dictation: {
        id: number
        content: DictationContentType
    } | null
    isOwner: boolean
}

export function DictationContent({ paperId, dictation: initialDictation, isOwner }: DictationContentProps) {
    const [dictation, setDictation] = useState(initialDictation)
    const [showEnglish, setShowEnglish] = useState(false)
    const [revealedEntries, setRevealedEntries] = useState<Set<string>>(new Set())
    const queryClient = useQueryClient()
    const { isLoggedIn } = useUser()

    const generateMutation = useMutation({
        mutationFn: async () => {
            const { data } = await generateDictationAction({ paperId })
            if (!data) {
                toast.error('生成默写纸失败')
                return
            }
            setDictation(data)
        },
    })

    const deleteMutation = useMutation({
        mutationFn: async () => {
            if (!dictation) return
            const { serverError } = await deleteDictationAction({
                paperId,
                dictationId: dictation.id
            })
            if (serverError) throw new Error(serverError)
        },
        onSuccess: () => {
            setDictation(null)
            toast.success('已删除默写纸')
        },
        onError: (error) => {
            toast.error(`删除失败：${error.message}`)
        },
    })

    const saveMutation = useMutation({
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
            queryClient.invalidateQueries({ queryKey: ['recent-chunk-notes'] })
            toast.success('已保存到笔记本')
        },
        onError: (error) => {
            toast.error(`保存失败：${error.message}`)
        },
    })

    const toggleReveal = (entryKey: string) => {
        setRevealedEntries(prev => {
            const newSet = new Set(prev)
            if (newSet.has(entryKey)) {
                newSet.delete(entryKey)
            } else {
                newSet.add(entryKey)
            }
            return newSet
        })
    }

    const isEntryRevealed = (entryKey: string) => {
        return showEnglish || revealedEntries.has(entryKey)
    }

    // No dictation yet - show generate button
    if (!dictation) {
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
                            正在生成默写纸，可能需要一分钟左右……
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

    // Has dictation - display it
    return (
        <div className='space-y-6'>
            {/* Header with toggle and delete button */}
            <div className='flex items-center justify-between'>
                <Switch
                    isSelected={showEnglish}
                    onValueChange={setShowEnglish}
                    size='sm'
                >
                    显示全部英文
                </Switch>
                {isOwner && (
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
                    <CardBody className='px-0'>
                        {section.entries.map((entry, entryIndex) => {
                            const entryKey = `${sectionIndex}-${entryIndex}`
                            const revealed = isEntryRevealed(entryKey)

                            return (
                                <div className='flex justify-between gap-1'>
                                    <p className='text-default-700'>{entry.chinese}</p>
                                    <div className='flex items-center justify-end gap-2'>
                                        {revealed && (
                                            <p className='text-primary font-medium mt-1 text-right'>
                                                {entry.english}
                                            </p>
                                        )}
                                        <Button
                                            size='sm'
                                            variant='light'
                                            onPress={() => toggleReveal(entryKey)}
                                            startContent={<EyeIcon weight='duotone' />}
                                            isIconOnly
                                        />
                                        {isLoggedIn && (
                                            <Button
                                                size='sm'
                                                variant='light'
                                                color='primary'
                                                onPress={() => saveMutation.mutate({
                                                    english: entry.english,
                                                    chinese: entry.chinese
                                                })}
                                                isLoading={saveMutation.isPending}
                                                isIconOnly
                                                startContent={<FloppyDiskIcon weight='duotone' />}
                                            />
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </CardBody>
                </Card>
            ))}
        </div>
    )
}
