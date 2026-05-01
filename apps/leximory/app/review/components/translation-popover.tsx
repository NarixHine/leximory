'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Spinner } from '@heroui/spinner'
import { PiSealCheck } from 'react-icons/pi'
import type { ReviewTranslation, ReviewTranslationFeedback } from '@/lib/review'
import { ReviewComposer } from './review-composer'
import { ReviewDialogShell } from './review-dialog-shell'

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
            return { start, end: start + pair.original.length, badPairIndex }
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
            segments.push({ text: answer.slice(cursor, match.start), badPairIndex: null })
        }

        segments.push({
            text: answer.slice(match.start, match.end),
            badPairIndex: match.badPairIndex,
        })
        cursor = match.end
    }

    if (cursor < answer.length) {
        segments.push({ text: answer.slice(cursor), badPairIndex: null })
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
        const badPairs = data.feedback?.badPairs
        if (!badPairs?.length) {
            setSelectedBadPairIndex(null)
            return
        }

        setSelectedBadPairIndex((currentIndex) => {
            if (currentIndex !== null && currentIndex < badPairs.length) {
                return currentIndex
            }
            return null
        })
    }, [isOpen, data?.status, data?.feedback])

    const submitMutation = useMutation({
        mutationFn: ({ index, submission }: { itemId: string; index: number; submission: string }) =>
            submitTranslation({ date, lang, index, submission }),
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

            if (activeItemIdRef.current !== variables.itemId) return

            setDraft(translation.submission ?? '')
            setOptimisticSubmission(translation.submission ?? null)
            setSelectedBadPairIndex(null)
        },
        onError: (_, variables) => {
            if (activeItemIdRef.current !== variables.itemId) return
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
        <>
            <ReviewDialogShell
                isOpen={isOpen}
                cardClassName='border-default-200 bg-default-50/95 p-2'
            >
                <div className='flex flex-col gap-2'>
                    <p className='font-mono text-xs uppercase text-default-400'>Translation</p>
                    <p className='text-base text-default-800'>
                        {data?.prompt || 'Loading...'}
                        <span className='ml-2 font-formal'>({data?.keyword})</span>
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
                                <p className='font-formal text-default-700'>{data.answer}</p>
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
                                <p className='font-mono text-xs uppercase text-default-400'>Your translation</p>
                                {(isSubmittingCurrentItem || isPendingEvaluation) ? (
                                    <div className='flex items-center gap-2 font-mono text-xs text-default-400'>
                                        <Spinner size='sm' variant='spinner' color='secondary' />
                                        <span>Evaluating</span>
                                    </div>
                                ) : null}
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
                                            className={`rounded-sm px-1 py-px transition-colors ${
                                                selectedBadPairIndex === segment.badPairIndex
                                                    ? 'bg-warning-300'
                                                    : 'bg-warning-200 hover:bg-warning-300/80'
                                            }`}
                                        >
                                            {segment.text}
                                        </button>
                                    )
                                })}
                            </div>

                            {isEvaluated && !hasFeedback && data?.feedback ? (
                                <div className='mt-2 inline-flex items-center gap-2 font-mono text-sm text-success-500'>
                                    <PiSealCheck className='size-5' />
                                    <span className='font-kaiti'>{data.feedback.rationale}</span>
                                </div>
                            ) : null}
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
                            <p className='font-mono text-xs uppercase text-warning'>Feedback</p>
                            <p className='mt-2 font-kaiti'>{selectedBadPair.improved}</p>
                        </motion.div>
                    ) : null}
                </AnimatePresence>
            </ReviewDialogShell>

            <ReviewComposer
                isOpen={isOpen && !displayedSubmission}
                value={draft}
                onChange={setDraft}
                onSubmit={handleSubmit}
                placeholder='Write your translation...'
                disabled={isSubmittingCurrentItem}
                canSubmit={canSubmit}
                isLoading={isSubmittingCurrentItem}
                className='border-default-200 bg-primary-50'
                textareaClassName='font-mono text-primary-700 placeholder:text-primary-400'
            />
        </>
    )
}
