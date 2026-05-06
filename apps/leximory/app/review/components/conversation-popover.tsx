'use client'

import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useOnClickOutside } from 'usehooks-ts'
import { Spinner } from '@heroui/spinner'
import { PiLockKey } from 'react-icons/pi'
import { Lang } from '@repo/env/config'
import {
    getConversationUnlockProgress,
    type ReviewConversation,
} from '@/lib/review'
import { getLanguageStrategy } from '@/lib/languages/strategies'
import type { ReviewTranslation } from '@/lib/review'
import { cn } from '@/lib/utils'
import { CAT_FRAME_ASPECT, CatSprite } from './cat-sprite'
import { ReviewComposer } from './review-composer'
import { ReviewDialogShell } from './review-dialog-shell'

interface ConversationExerciseProps {
    date: string
    lang: string
    isOpen: boolean
    onClose: () => void
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

interface ConversationMessageProps {
    variant: 'white' | 'black'
    content: ReactNode
    accent?: ReactNode
    pendingLabel?: string | null
    bodyClassName?: string
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

function ConversationMessage({
    variant,
    content,
    accent,
    pendingLabel,
    bodyClassName,
}: ConversationMessageProps) {
    const avatarVariant = variant === 'black' ? 'black' : 'white'
    const avatarHeightRem = 4.6
    const avatarWidthRem = avatarHeightRem * CAT_FRAME_ASPECT

    return (
        <div className='text-heimao-800'>
            <div className={cn('max-h-50 overflow-auto', bodyClassName)}>
                <div
                    className={cn('float-left -mb-3 -mt-2 -ml-6 overflow-visible', avatarVariant === 'black' ? ' -mr-7' : ' -mr-10')}
                    style={{
                        height: `${avatarHeightRem}rem`,
                        width: `${avatarWidthRem}rem`,
                    }}
                >
                    <CatSprite variant={avatarVariant} frame='idle' />
                </div>

                {content}
            </div>

            {pendingLabel ? (
                <div className='mt-2 flex clear-left items-center gap-2 text-xs text-heimao-500'>
                    <Spinner size='sm' variant='dots' color='secondary' />
                    <span className='font-mono uppercase tracking-[0.2em]'>{pendingLabel}</span>
                </div>
            ) : null}

            {accent ? <div className='mt-2 clear-left text-sm text-heimao-600'>{accent}</div> : null}
        </div>
    )
}

export function ConversationExercise({
    date,
    lang,
    isOpen,
    onClose,
    data,
    translations,
    isLocked,
}: ConversationExerciseProps) {
    const queryClient = useQueryClient()
    const popoverRef = useRef<HTMLDivElement>(null)
    const [draft, setDraft] = useState('')
    const [optimisticSubmission, setOptimisticSubmission] = useState<string | null>(null)
    const [selectedTone, setSelectedTone] = useState<SegmentTone | null>(null)
    const [selectedPairIndex, setSelectedPairIndex] = useState<number | null>(null)

    useOnClickOutside(popoverRef as React.RefObject<HTMLElement>, () => {
        if (isOpen) onClose()
    })

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

            setDraft(conversation.submission ?? '')
            setOptimisticSubmission(conversation.submission ?? null)
            setSelectedTone(null)
            setSelectedPairIndex(null)
        },
        onError: () => {
            setOptimisticSubmission(null)
        },
    })

    const unlockProgress = getConversationUnlockProgress(translations)
    const languageStrategy = getLanguageStrategy(lang as Lang)
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

    const lockMessage = languageStrategy.reviewLabels?.lockMessage(unlockProgress.requiredTranslations) ?? (
        <>
            {unlockProgress.requiredTranslations > 0
                ? 'Complete 60% of your vocabulary reviews before the little black cat will speak softly.'
                : 'There are no translation exercises available to unlock today.'}
        </>
    )

    return (
        <div ref={popoverRef}>
            <ReviewDialogShell
                isOpen={isOpen}
                cardClassName='bg-heimao-50 border-heimao-200 p-2 shadow-none'
            >
                <div className='space-y-4'>
                    {isLocked ? (
                        <div className='space-y-3'>
                            <ConversationMessage
                                variant='black'
                                content={<p className='text-heimao-700'>{lockMessage}
                                    <span className='font-kaiti'>
                                        <PiLockKey className='h-4 w-4 inline-block mx-2' />
                                        完成翻译 {unlockProgress.completedTranslations}/{unlockProgress.requiredTranslations}
                                    </span>
                                </p>}
                            />
                        </div>
                    ) : (
                        <ConversationMessage
                            variant='black'
                            content={<p className='font-cute text-2xl leading-tight text-heimao-700 mb-1'>{data?.prompt || '...'}</p>}
                            accent={data?.keywords?.length
                                ? <p className='font-mono text-sm text-center text-balance tracking-wide'>不妨试试选用 {data.keywords.slice(0, 6).join(' / ')}</p>
                                : null}
                        />
                    )}

                    {!isLocked && displayedSubmission ? (
                        <div className='space-y-4'>
                            <ConversationMessage
                                variant='white'
                                pendingLabel={isPendingEvaluation ? '思考中' : null}
                                content={(
                                    <div className='whitespace-pre-wrap font-mono leading-7'>
                                        {highlightSegments.map((segment, index) => {
                                            if (!segment.tone) {
                                                return <span key={`${segment.text}-${index}`}>{segment.text}</span>
                                            }

                                            const active = selectedTone === segment.tone && selectedPairIndex === segment.pairIndex
                                            const toneClass = segment.tone === 'good'
                                                ? active
                                                    ? 'decoration-heimao-700 text-heimao-900'
                                                    : 'decoration-heimao-400 hover:decoration-heimao-600'
                                                : active
                                                    ? 'decoration-warning-700 text-heimao-900'
                                                    : 'decoration-warning-500 hover:decoration-warning-600'

                                            return (
                                                <span
                                                    key={`${segment.text}-${index}`}
                                                    onClick={() => {
                                                        setSelectedTone(segment.tone)
                                                        setSelectedPairIndex(segment.pairIndex)
                                                    }}
                                                    className={cn(
                                                        'cursor-pointer underline decoration-2 underline-offset-[0.28em] transition-colors',
                                                        toneClass
                                                    )}
                                                >
                                                    {segment.text}
                                                </span>
                                            )
                                        })}
                                    </div>
                                )}
                                accent={data?.feedback ? (
                                    <div className='space-y-2 text-left'>
                                        {selectedGoodPair ? (
                                            <p className='font-kaiti text-sm text-heimao-700'>
                                                {selectedGoodPair.note}
                                            </p>
                                        ) : null}
                                        {selectedBadPair ? (
                                            <p className='font-kaiti text-sm text-warning-700'>
                                                {selectedBadPair.improved}
                                            </p>
                                        ) : null}
                                    </div>
                                ) : null}
                            />

                            {data?.reply ? (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    <ConversationMessage
                                        variant='black'
                                        content={<p className='font-cute text-2xl leading-tight text-heimao-700'>{data.reply}</p>}
                                    />
                                </motion.div>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            </ReviewDialogShell>

            <ReviewComposer
                isOpen={isOpen && !isLocked && !displayedSubmission}
                value={draft}
                onChange={setDraft}
                onSubmit={handleSubmit}
                placeholder='写给小黑猫的话……'
                disabled={submitMutation.isPending}
                canSubmit={canSubmit}
                isLoading={submitMutation.isPending}
                rows={4}
                className='border-default-200 bg-primary-50'
                textareaClassName='font-mono text-primary-700 placeholder:text-primary-400'
            />
        </div>
    )
}
