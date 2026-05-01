'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Spinner } from '@heroui/spinner'
import { PiLockKey, PiSealCheckFill, PiStarFill } from 'react-icons/pi'
import {
    getConversationUnlockProgress,
    type ReviewConversation,
} from '@/lib/review'
import type { ReviewTranslation } from '@/lib/review'
import { ReviewComposer } from './review-composer'
import { ReviewDialogShell } from './review-dialog-shell'

interface ConversationExerciseProps {
    date: string
    lang: string
    isOpen: boolean
    data?: ReviewConversation | null
    translations?: ReviewTranslation[]
    isLocked?: boolean
}

interface SubmitConversationResponse {
    success: boolean
    conversation: ReviewConversation
}

type SegmentTone = 'good' | 'bad'

interface HighlightSegment {
    text: string
    tone: SegmentTone | null
    pairIndex: number | null
}

async function submitConversation({
    date,
    lang,
    submission,
}: {
    date: string
    lang: string
    submission: string
}): Promise<SubmitConversationResponse> {
    const res = await fetch('/api/review/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, lang, submission }),
    })

    if (!res.ok) {
        throw new Error('Failed to submit conversation')
    }

    return res.json()
}

function buildConversationSegments(answer: string, feedback: ReviewConversation['feedback']): HighlightSegment[] {
    if (!feedback) return [{ text: answer, tone: null, pairIndex: null }]

    const matches = [
        ...feedback.goodPairs.map((pair, pairIndex) => {
            const start = answer.indexOf(pair.original)
            if (start === -1) return null
            return { start, end: start + pair.original.length, tone: 'good' as const, pairIndex }
        }),
        ...feedback.badPairs.map((pair, pairIndex) => {
            const start = answer.indexOf(pair.original)
            if (start === -1) return null
            return { start, end: start + pair.original.length, tone: 'bad' as const, pairIndex }
        }),
    ]
        .filter((match): match is { start: number; end: number; tone: SegmentTone; pairIndex: number } => match !== null)
        .sort((a, b) => a.start - b.start || b.end - a.end)

    if (matches.length === 0) return [{ text: answer, tone: null, pairIndex: null }]

    const segments: HighlightSegment[] = []
    let cursor = 0

    for (const match of matches) {
        if (match.start < cursor) continue

        if (match.start > cursor) {
            segments.push({ text: answer.slice(cursor, match.start), tone: null, pairIndex: null })
        }

        segments.push({
            text: answer.slice(match.start, match.end),
            tone: match.tone,
            pairIndex: match.pairIndex,
        })
        cursor = match.end
    }

    if (cursor < answer.length) {
        segments.push({ text: answer.slice(cursor), tone: null, pairIndex: null })
    }

    return segments
}

export function ConversationExercise({
    date,
    lang,
    isOpen,
    data,
    translations,
    isLocked,
}: ConversationExerciseProps) {
    const queryClient = useQueryClient()
    const [draft, setDraft] = useState('')
    const [optimisticSubmission, setOptimisticSubmission] = useState<string | null>(null)
    const [selectedTone, setSelectedTone] = useState<SegmentTone | null>(null)
    const [selectedPairIndex, setSelectedPairIndex] = useState<number | null>(null)
    const activeRef = useRef(isOpen)

    activeRef.current = isOpen

    useEffect(() => {
        if (!isOpen) return
        setDraft(data?.submission ?? '')
        setOptimisticSubmission(data?.submission ?? null)
        setSelectedTone(null)
        setSelectedPairIndex(null)
    }, [isOpen, data?.submission])

    const submitMutation = useMutation({
        mutationFn: ({ submission }: { submission: string }) => submitConversation({ date, lang, submission }),
        onSuccess: ({ conversation }) => {
            queryClient.setQueryData(
                ['review', 'check', date, lang],
                (previous: {
                    exists?: boolean
                    story?: string
                    translations?: ReviewTranslation[]
                    conversation?: ReviewConversation | null
                } | undefined) => previous ? { ...previous, conversation } : previous
            )
            queryClient.invalidateQueries({ queryKey: ['review', 'check', date, lang] })

            if (!activeRef.current) return

            setDraft(conversation.submission ?? '')
            setOptimisticSubmission(conversation.submission ?? null)
            setSelectedTone(null)
            setSelectedPairIndex(null)
        },
        onError: () => {
            if (!activeRef.current) return
            setOptimisticSubmission(null)
        },
    })

    const unlockProgress = getConversationUnlockProgress(translations)
    const displayedSubmission = data?.submission ?? optimisticSubmission
    const isPendingEvaluation = data?.status === 'pending'
    const canSubmit = draft.trim().length > 0 && !submitMutation.isPending && !isLocked
    const highlightSegments = useMemo(
        () => buildConversationSegments(displayedSubmission ?? '', data?.feedback),
        [displayedSubmission, data?.feedback]
    )

    const selectedGoodPair = selectedTone === 'good' && selectedPairIndex !== null
        ? data?.feedback?.goodPairs[selectedPairIndex]
        : null
    const selectedBadPair = selectedTone === 'bad' && selectedPairIndex !== null
        ? data?.feedback?.badPairs[selectedPairIndex]
        : null

    const handleSubmit = () => {
        if (!canSubmit) return
        const submission = draft.trim()
        setOptimisticSubmission(submission)
        submitMutation.mutate({ submission })
    }

    const lockMessage = unlockProgress.requiredTranslations > 0
        ? `需完成 60% 词汇复习，小黑猫才会轻轻开口。`
        : '今日没有可用于解锁的翻译题。'

    return (
        <>
            <ReviewDialogShell
                isOpen={isOpen}
                cardClassName='border-[#b9b0ad] bg-[#f1ebe8]/95 p-2'
            >
                <div className='flex items-start gap-3'>
                    <div className='mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#403c43] text-[#f8f0ea]'>
                        <PiSealCheckFill className='h-4 w-4' />
                    </div>
                    <div className='flex-1 space-y-1'>
                        <p className='font-mono text-xs uppercase tracking-wide text-[#7e7370]'>Writing Practice</p>
                        {isLocked ? (
                            <div className='space-y-3'>
                                <p className='font-kaiti text-base text-[#4c4443]'>{lockMessage}</p>
                                <div className='inline-flex items-center gap-2 rounded-full bg-[#e6ddda] px-3 py-1 text-xs text-[#6a605d]'>
                                    <PiLockKey className='h-4 w-4' />
                                    <span>
                                        完成翻译 {unlockProgress.completedTranslations}/{unlockProgress.requiredTranslations}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <>
                                <p className='font-formal italic text-base text-[#433a39]'>{data?.prompt || '...'}</p>
                                {data?.keywords?.length ? (
                                    <p className='font-mono text-primary-500'>
                                        试着带上 {data.keywords.slice(0, 6).join(' / ')}
                                    </p>
                                ) : null}
                            </>
                        )}
                    </div>
                </div>

                {!isLocked && displayedSubmission ? (
                    <div className='space-y-4'>
                        <div>
                            <div className='flex items-center justify-between gap-3'>
                                <p className='font-mono text-xs uppercase text-[#7e7370]'>Your reply</p>
                                {isPendingEvaluation ? (
                                    <div className='flex items-center gap-2 font-mono text-xs text-[#7e7370]'>
                                        <Spinner size='sm' variant='spinner' color='secondary' />
                                        <span>Listening</span>
                                    </div>
                                ) : null}
                            </div>
                            <div className='mt-2 whitespace-pre-wrap font-mono text-[#4a4140]'>
                                {highlightSegments.map((segment, index) => {
                                    if (!segment.tone) {
                                        return <span key={`${segment.text}-${index}`}>{segment.text}</span>
                                    }

                                    const active = selectedTone === segment.tone && selectedPairIndex === segment.pairIndex
                                    const toneClass = segment.tone === 'good'
                                        ? active ? 'bg-success-200' : 'bg-success-100 hover:bg-success-200'
                                        : active ? 'bg-warning-300' : 'bg-warning-200 hover:bg-warning-300/80'

                                    return (
                                        <button
                                            key={`${segment.text}-${index}`}
                                            type='button'
                                            onClick={() => {
                                                setSelectedTone(segment.tone)
                                                setSelectedPairIndex(segment.pairIndex)
                                            }}
                                            className={`rounded-sm px-1 py-px transition-colors ${toneClass}`}
                                        >
                                            {segment.text}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {data?.feedback ? (
                            <div className='space-y-2'>
                                <p className='font-kaiti text-sm text-[#5f5553]'>{data.feedback.rationale}</p>
                                {selectedGoodPair ? <p className='font-kaiti text-sm text-success-700'>{selectedGoodPair.note}</p> : null}
                                {selectedBadPair ? <p className='font-kaiti text-sm text-warning-700'>{selectedBadPair.improved}</p> : null}
                            </div>
                        ) : null}

                        {data?.reply ? (
                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                            >
                                <p className='font-formal italic'>{data.reply}</p>
                            </motion.div>
                        ) : null}
                    </div>
                ) : null}
            </ReviewDialogShell>

            <ReviewComposer
                isOpen={isOpen && !isLocked && !displayedSubmission}
                value={draft}
                onChange={setDraft}
                onSubmit={handleSubmit}
                placeholder='Reply to the dark cat...'
                disabled={submitMutation.isPending}
                canSubmit={canSubmit}
                isLoading={submitMutation.isPending}
                rows={4}
                className='border-[#d8ccc7] bg-[#fbf8f7]'
                textareaClassName='font-formal text-[#433a39] placeholder:text-[#9d8d88]'
            />
        </>
    )
}
