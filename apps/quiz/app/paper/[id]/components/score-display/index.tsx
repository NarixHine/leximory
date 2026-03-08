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
        <h1 className='mt-2 mb-5 text-balance items-baseline-last flex'>
            {isMarkingPending ? (
                <>
                    <style>{`
                        @keyframes dashMove {
                            from { stroke-dashoffset: 18; }
                            to   { stroke-dashoffset: 0; }
                        }
                        @media (prefers-reduced-motion: reduce) {
                            .dash-animate { animation: none !important; }
                        }
                    `}</style>
                    <span
                        className='text-5xl leading-none inline-block relative'
                        aria-label={String(score)}
                    >
                        <span style={{ visibility: 'hidden' }}>{score}</span>
                        <svg
                            aria-hidden='true'
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible' }}
                        >
                            <text
                                x='0'
                                y='0.82em'
                                className='dash-animate'
                                style={{
                                    fill: 'transparent',
                                    stroke: 'currentColor',
                                    strokeWidth: '1.5px',
                                    strokeDasharray: '6 3',
                                    animation: 'dashMove 2s linear infinite',
                                    fontSize: '1em',
                                    fontWeight: 'bold',
                                    fontFamily: 'inherit',
                                }}
                            >
                                {score}
                            </text>
                        </svg>
                    </span>
                </>
            ) : (
                <span className='text-5xl font-bold'>{score}</span>
            )}
            <span className='text-default-400 font-semibold text-xl flex items-center font-mono'>
                <Spacer x={'px'} />/<Spacer x={'px'} />{perfectScore}
            </span>
        </h1>
    )
}
