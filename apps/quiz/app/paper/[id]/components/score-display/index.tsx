'use client'

import { useAtomValue } from 'jotai'
import { feedbackAtom, editoryItemsAtom } from '@repo/ui/paper/atoms'
import { SUBJECTIVE_TYPES } from '@repo/schema/paper'
import { Spacer } from '@heroui/spacer'

/**
 * Score display that shows a 镂空描边 (hollow outline) effect while
 * subjective sections are still being marked, and a filled score once
 * all marking is complete.
 */
export function ScoreDisplay({ score, perfectScore }: { score: number, perfectScore: number }) {
    const feedback = useAtomValue(feedbackAtom)
    const quizItems = useAtomValue(editoryItemsAtom)

    const subjectiveSections = quizItems.filter(
        (s) => (SUBJECTIVE_TYPES as readonly string[]).includes(s.type)
    )
    const isMarkingPending = subjectiveSections.length > 0 && subjectiveSections.some(
        (s) => !feedback?.[s.id]
    )

    return (
        <h1 className='font-bold mt-2 mb-5 text-balance items-baseline flex'>
            <span
                className={`text-5xl ${isMarkingPending ? 'animate-shimmer' : ''}`}
                style={isMarkingPending ? {
                    color: 'transparent',
                    WebkitTextStroke: '1.5px var(--color-foreground)',
                } : undefined}
            >
                {score}
            </span>
            <span className='text-default-400 text-xl flex items-center font-mono'>
                /{perfectScore}<Spacer x={0.5} />分
            </span>
        </h1>
    )
}
