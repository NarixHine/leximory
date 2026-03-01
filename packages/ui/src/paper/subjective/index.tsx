'use client'

import { useAtomValue, useSetAtom } from 'jotai'
import { answersAtom, setAnswerAtom, viewModeAtom, submittedAnswersAtom } from '../atoms'
import { Textarea } from '@heroui/react'
import { useMemo } from 'react'

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
            variant='bordered'
            minRows={3}
            maxRows={10}
            maxLength={maxLength}
            className='mt-3'
            classNames={{
                input: 'text-sm',
                inputWrapper: 'shadow-sm',
            }}
        />
    )
}

/**
 * Summary input with an animated SVG ring that traces the border as word count approaches 60,
 * and a word counter at the bottom. Ring color: green → yellow (50 words) → red (60+ words).
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

    // SVG rect perimeter for the ring. Using a rounded rect matching the container.
    // We use viewBox-relative units; the SVG is stretched to fit.
    const rx = 12
    const ry = 12
    const w = 400
    const h = 120
    // Approximate perimeter of a rounded rect
    const perimeter = 2 * (w - 2 * rx) + 2 * (h - 2 * ry) + 2 * Math.PI * rx

    const dashOffset = perimeter * (1 - progress)

    return (
        <div className='mt-3 relative'>
            {/* SVG ring overlay */}
            <svg
                className='absolute inset-0 w-full h-full pointer-events-none z-10'
                viewBox={`0 0 ${w} ${h}`}
                preserveAspectRatio='none'
                fill='none'
            >
                <rect
                    x='1' y='1'
                    width={w - 2} height={h - 2}
                    rx={rx} ry={ry}
                    stroke={ringColor}
                    strokeWidth={2.5}
                    strokeDasharray={perimeter}
                    strokeDashoffset={dashOffset}
                    strokeLinecap='round'
                    style={{
                        transition: 'stroke-dashoffset 0.4s ease, stroke 0.3s ease',
                    }}
                />
            </svg>
            <Textarea
                value={currentAnswer}
                onValueChange={(value) => setAnswer({ sectionId: groupId, localQuestionNo: localNo, option: value })}
                variant='bordered'
                minRows={3}
                maxRows={10}
                classNames={{
                    input: 'text-sm',
                    inputWrapper: 'shadow-sm !border-transparent',
                }}
            />
            {/* Word counter */}
            <div className='flex justify-end mt-1 pr-1'>
                <span className={`text-xs tabular-nums ${wordCount >= 60 ? 'text-danger font-medium' : wordCount >= 50 ? 'text-warning font-medium' : 'text-default-400'}`}>
                    {wordCount} / 60
                </span>
            </div>
        </div>
    )
}
