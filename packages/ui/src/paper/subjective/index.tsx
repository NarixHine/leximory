'use client'

import { useAtomValue, useSetAtom } from 'jotai'
import { answersAtom, setAnswerAtom, viewModeAtom, submittedAnswersAtom } from '../atoms'
import { Textarea } from '@heroui/react'
import { useMemo, useCallback } from 'react'

/** Counts words in a string (whitespace-separated tokens). */
function countWords(text: string): number {
    const trimmed = text.trim()
    if (!trimmed) return 0
    return trimmed.split(/\s+/).length
}

/**
 * A text area input for subjective question types (summary, translation, writing).
 * In normal mode, it provides an editable text area.
 * In revise mode, it displays the submitted answer as read-only.
 */
export function SubjectiveInput({ groupId, localNo, placeholder, maxLength, variant = 'default' }: {
    groupId: string
    localNo: number
    placeholder?: string
    maxLength?: number
    /** Use 'summary' for the animated ring + word counter variant. */
    variant?: 'default' | 'summary'
}) {
    const viewMode = useAtomValue(viewModeAtom)
    const answers = useAtomValue(answersAtom)
    const submittedAnswers = useAtomValue(submittedAnswersAtom)
    const setAnswer = useSetAtom(setAnswerAtom)

    const isRevise = viewMode === 'revise'
    const currentAnswer = isRevise
        ? submittedAnswers[groupId]?.[localNo] ?? ''
        : answers[groupId]?.[localNo] ?? ''

    if (isRevise) {
        return (
            <div className='mt-3 p-4 bg-default-50 rounded-large text-sm whitespace-pre-wrap min-h-20 border border-default-200'>
                {currentAnswer || <span className='text-default-400 italic'>（未作答）</span>}
            </div>
        )
    }

    if (variant === 'summary') {
        return <SummaryInputWithRing groupId={groupId} localNo={localNo} currentAnswer={currentAnswer} setAnswer={setAnswer} />
    }

    return (
        <Textarea
            value={currentAnswer}
            onValueChange={(value) => setAnswer({ sectionId: groupId, localQuestionNo: localNo, option: value })}
            placeholder={placeholder}
            variant='underlined'
            minRows={3}
            maxRows={10}
            maxLength={maxLength}
            className='mt-2'
            classNames={{
                input: 'text-sm',
            }}
        />
    )
}

/**
 * Summary input with an animated SVG ring that traces the border as word count approaches 60,
 * and a word counter at the bottom. Ring color: green → yellow (50 words) → red (60+ words).
 * Uses a native textarea styled with a default border for the ring to trace.
 */
function SummaryInputWithRing({ groupId, localNo, currentAnswer, setAnswer }: {
    groupId: string
    localNo: number
    currentAnswer: string
    setAnswer: (payload: { sectionId: string; localQuestionNo: number; option: string }) => void
}) {
    const wordCount = useMemo(() => countWords(currentAnswer), [currentAnswer])

    // Progress: 0 at 0 words, 1 at 60 words
    const progress = Math.min(wordCount / 60, 1)

    // Color: green base → yellow at 50 → red at 60+
    const ringColor = wordCount >= 60 ? '#ef4444' : wordCount >= 50 ? '#eab308' : '#22c55e'

    const pathLen = 1000
    const dashOffset = pathLen * (1 - progress)

    // Auto-resize height based on content
    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setAnswer({ sectionId: groupId, localQuestionNo: localNo, option: e.target.value })
        const el = e.target
        el.style.height = 'auto'
        el.style.height = `${el.scrollHeight}px`
    }, [setAnswer, groupId, localNo])

    return (
        <div className='mt-3 flex flex-col gap-1'>
            <div className='relative'>
                {/* SVG ring that traces the border */}
                <svg
                    className='absolute inset-0 w-full h-full pointer-events-none z-10'
                    preserveAspectRatio='none'
                    fill='none'
                >
                    <rect
                        x='1' y='1'
                        width='calc(100% - 2px)' height='calc(100% - 2px)'
                        rx={11} ry={11}
                        stroke={ringColor}
                        strokeWidth={2}
                        pathLength={pathLen}
                        strokeDasharray={pathLen}
                        strokeDashoffset={dashOffset}
                        strokeLinecap='round'
                        style={{
                            transition: 'stroke-dashoffset 0.4s ease, stroke 0.3s ease',
                        }}
                    />
                </svg>
                <textarea
                    value={currentAnswer}
                    onChange={handleChange}
                    rows={3}
                    aria-label='Summary'
                    className='w-full resize-none rounded-medium border border-default-200 bg-transparent px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-default-400 outline-none transition-colors focus:border-default-400'
                />
            </div>
            {/* Word counter */}
            <div className='flex justify-end pr-1'>
                <span className={`text-xs font-mono ${wordCount >= 60 ? 'text-danger font-medium' : wordCount >= 50 ? 'text-warning font-medium' : 'text-default-400'}`}>
                    {wordCount} / 60
                </span>
            </div>
        </div>
    )
}
