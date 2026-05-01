'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@heroui/button'
import { Card, CardBody } from '@heroui/card'
import { Spinner } from '@heroui/spinner'
import { PiArrowUp, PiSealCheck } from 'react-icons/pi'
import type { ReviewTranslation, ReviewTranslationFeedback } from '@/lib/review'

interface TranslationExerciseProps {
    date: string
    lang: string
    isOpen: boolean
    itemId?: string
    index?: number
    data?: ReviewTranslation
}

interface SubmitTranslationResponse {
    success: boolean
    translation: ReviewTranslation
}

interface HighlightSegment {
    text: string
    badPairIndex: number | null
}

async function submitTranslation({
    date,
    lang,
    index,
    submission,
}: {
    date: string
    lang: string
    index: number
    submission: string
}): Promise<SubmitTranslationResponse> {
    const res = await fetch('/api/review/translation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, lang, index, submission }),
    })

    if (!res.ok) {
        throw new Error('Failed to submit translation')
    }

    return res.json()
}

function buildHighlightSegments(answer: string, feedback: ReviewTranslationFeedback | null | undefined): HighlightSegment[] {
    if (!feedback?.badPairs.length) {
        return [{ text: answer, badPairIndex: null }]
    }

    const matches = feedback.badPairs
        .map((pair, badPairIndex) => {
            const start = answer.indexOf(pair.original)
            if (start === -1) return null
            return {
                start,
                end: start + pair.original.length,
                badPairIndex,
            }
        })
        .filter((match): match is { start: number; end: number; badPairIndex: number } => match !== null)
        .sort((a, b) => a.start - b.start || b.end - a.end)

    if (matches.length === 0) {
        return [{ text: answer, badPairIndex: null }]
    }

    const segments: HighlightSegment[] = []
    let cursor = 0

    for (const match of matches) {
        if (match.start < cursor) continue

        if (match.start > cursor) {
            segments.push({
                text: answer.slice(cursor, match.start),
                badPairIndex: null,
            })
        }

        segments.push({
            text: answer.slice(match.start, match.end),
            badPairIndex: match.badPairIndex,
        })
        cursor = match.end
    }

    if (cursor < answer.length) {
        segments.push({
            text: answer.slice(cursor),
            badPairIndex: null,
        })
    }

    return segments
}

export function TranslationExercise({
    date,
    lang,
    isOpen,
    itemId,
    index,
    data,
}: TranslationExerciseProps) {
    const queryClient = useQueryClient()
    const [draft, setDraft] = useState('')
    const [optimisticSubmission, setOptimisticSubmission] = useState<string | null>(null)
    const [selectedBadPairIndex, setSelectedBadPairIndex] = useState<number | null>(null)
    const [submittingItemIds, setSubmittingItemIds] = useState<Set<string>>(() => new Set())
    const activeItemIdRef = useRef<string | undefined>(itemId)

    activeItemIdRef.current = itemId

    useEffect(() => {
        if (!isOpen || !itemId) return
        setDraft(data?.submission ?? '')
        setOptimisticSubmission(data?.submission ?? null)
        setSelectedBadPairIndex(null)
    }, [isOpen, itemId, data?.submission])

    useEffect(() => {
        if (!isOpen || data?.status !== 'complete') return
        if (!data.feedback?.badPairs.length) {
            setSelectedBadPairIndex(null)
            return
        }
        setSelectedBadPairIndex((currentIndex) => {
            if (currentIndex !== null && currentIndex < data.feedback!.badPairs.length) {
                return currentIndex
            }
            return null
        })
    }, [isOpen, data?.status, data?.feedback])

    const submitMutation = useMutation({
        mutationFn: ({ index, submission }: { itemId: string; index: number; submission: string }) => submitTranslation({
            date,
            lang,
            index,
            submission,
        }),
        onSuccess: ({ translation }, variables) => {
            queryClient.setQueryData(
                ['review', 'check', date, lang],
                (previous: {
                    exists?: boolean
                    story?: string
                    translations?: ReviewTranslation[]
                } | undefined) => {
                    if (!previous?.translations) return previous
                    return {
                        ...previous,
                        translations: previous.translations.map((item, itemIndex) =>
                            itemIndex === variables.index ? translation : item
                        ),
                    }
                }
            )
            queryClient.invalidateQueries({ queryKey: ['review', 'check', date, lang] })

            if (activeItemIdRef.current !== variables.itemId) {
                return
            }

            setDraft(translation.submission ?? '')
            setOptimisticSubmission(translation.submission ?? null)
            setSelectedBadPairIndex(null)
        },
        onError: (_, variables) => {
            if (activeItemIdRef.current !== variables.itemId) {
                return
            }
            setOptimisticSubmission(null)
        },
        onSettled: (_, __, variables) => {
            setSubmittingItemIds((current) => {
                const next = new Set(current)
                next.delete(variables.itemId)
                return next
            })
        },
    })

    const displayedSubmission = data?.submission ?? optimisticSubmission
    const isSubmittingCurrentItem = itemId ? submittingItemIds.has(itemId) : false
    const isPendingEvaluation = data?.status === 'pending'
    const isEvaluated = data?.status === 'complete'
    const hasFeedback = Boolean(data?.feedback?.badPairs.length)
    const canSubmit = index !== undefined && draft.trim().length > 0 && !isSubmittingCurrentItem
    const highlightSegments = useMemo(
        () => buildHighlightSegments(displayedSubmission ?? '', data?.feedback),
        [displayedSubmission, data?.feedback]
    )
    const selectedBadPair = selectedBadPairIndex !== null ? data?.feedback?.badPairs[selectedBadPairIndex] : null

    const handleSubmit = () => {
        if (!canSubmit || index === undefined || !itemId) return

        const submission = draft.trim()
        setOptimisticSubmission(submission)
        setSubmittingItemIds((current) => {
            const next = new Set(current)
            next.add(itemId)
            return next
        })
        submitMutation.mutate({ itemId, index, submission })
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        className='fixed top-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4'
                    >
                        <Card shadow='none' className='bg-default-50/95 p-2 shadow-none border-7 border-default-200 rounded-4xl backdrop-blur'>
                            <CardBody className='gap-4'>
                                <div className='flex flex-col gap-2'>
                                    <p className='text-xs text-default-400 uppercase font-mono'>Translation</p>
                                    <p className='text-base text-default-800'>
                                        {data?.prompt || 'Loading...'}
                                        <span className='font-formal ml-2'>({data?.keyword})</span>
                                    </p>
                                    <AnimatePresence initial={false}>
                                        {displayedSubmission && data?.answer ? (
                                            <motion.div
                                                key='reference'
                                                initial={{ opacity: 0, height: 0, y: -6 }}
                                                animate={{ opacity: 1, height: 'auto', y: 0 }}
                                                exit={{ opacity: 0, height: 0, y: -6 }}
                                                transition={{ duration: 0.28 }}
                                                className='overflow-hidden'
                                            >
                                                <p className='text-default-700 font-formal'>
                                                    {data.answer}
                                                </p>
                                            </motion.div>
                                        ) : null}
                                    </AnimatePresence>
                                </div>

                                <AnimatePresence initial={false}>
                                    {displayedSubmission ? (
                                        <motion.div
                                                key='submission'
                                            initial={{ opacity: 0, height: 0, y: -8 }}
                                            animate={{ opacity: 1, height: 'auto', y: 0 }}
                                            exit={{ opacity: 0, height: 0, y: -8 }}
                                            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                                            className='overflow-hidden'
                                        >
                                            <div className='flex items-start justify-between gap-3'>
                                                <p className='text-xs uppercase text-default-400 font-mono'>Your translation</p>
                                                {(isSubmittingCurrentItem || isPendingEvaluation) && (
                                                    <div className='flex items-center gap-2 text-xs text-default-400 font-mono'>
                                                        <Spinner size='sm' variant='spinner' color='secondary' />
                                                        <span>Evaluating</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className='mt-2 whitespace-pre-wrap wrap-break-word font-mono text-default-700'>
                                                {highlightSegments.map((segment, segmentIndex) => {
                                                    if (segment.badPairIndex === null) {
                                                        return <span key={`${segment.text}-${segmentIndex}`}>{segment.text}</span>
                                                    }

                                                    return (
                                                        <button
                                                            key={`${segment.text}-${segmentIndex}`}
                                                            type='button'
                                                            onClick={() => setSelectedBadPairIndex(segment.badPairIndex)}
                                                            className={`rounded-sm px-1 py-px transition-colors ${selectedBadPairIndex === segment.badPairIndex
                                                                ? 'bg-warning-300'
                                                                : 'bg-warning-200 hover:bg-warning-200'
                                                                }`}
                                                        >
                                                            {segment.text}
                                                        </button>
                                                    )
                                                })}
                                            </div>

                                            {isEvaluated && !hasFeedback && data && (
                                                <div className='mt-2 inline-flex items-center gap-2 text-success-400 font-mono text-sm'>
                                                    <PiSealCheck className='size-5' />{data.feedback && <span className='font-kaiti'>{data.feedback.rationale}</span>}
                                                </div>
                                            )}
                                        </motion.div>
                                    ) : null}
                                </AnimatePresence>

                                <AnimatePresence initial={false}>
                                    {selectedBadPair ? (
                                        <motion.div
                                            key='feedback'
                                            initial={{ opacity: 0, height: 0, y: -6 }}
                                            animate={{ opacity: 1, height: 'auto', y: 0 }}
                                            exit={{ opacity: 0, height: 0, y: -6 }}
                                            transition={{ duration: 0.28 }}
                                            className='overflow-hidden'
                                        >
                                            <p className='text-xs uppercase text-warning font-mono'>Feedback</p>
                                            <p className='mt-2 font-kaiti'>
                                                {selectedBadPair.improved}
                                            </p>
                                        </motion.div>
                                    ) : null}
                                </AnimatePresence>
                            </CardBody>
                        </Card>
                    </motion.div>

                    {!displayedSubmission && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                            className='fixed bottom-6 left-0 right-0 z-50 px-4'
                        >
                            <div className='max-w-2xl mx-auto'>
                                <div className='bg-primary-50 rounded-4xl border border-default-200 p-3 pt-2'>
                                    <textarea
                                        value={draft}
                                        onChange={(event) => setDraft(event.target.value)}
                                        className='w-full px-3 py-2 text-primary-700 placeholder:text-primary-400 resize-none focus:outline-none bg-transparent border-0 font-mono'
                                        rows={2}
                                        placeholder='Write your translation...'
                                        disabled={isSubmittingCurrentItem}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' && !event.shiftKey) {
                                                event.preventDefault()
                                                handleSubmit()
                                            }
                                        }}
                                    />
                                    <div className='flex justify-end mt-2 pt-2'>
                                        <Button
                                            isIconOnly
                                            color='primary'
                                            radius='full'
                                            size='sm'
                                            onPress={handleSubmit}
                                            isLoading={isSubmittingCurrentItem}
                                            isDisabled={!canSubmit}
                                        >
                                            <PiArrowUp className='w-4 h-4' />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </>
            )}
        </AnimatePresence>
    )
}
