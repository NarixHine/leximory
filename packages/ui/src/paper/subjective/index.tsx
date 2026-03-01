'use client'

import { useAtomValue, useSetAtom } from 'jotai'
import { answersAtom, setAnswerAtom, viewModeAtom, submittedAnswersAtom } from '../atoms'
import { Textarea } from '@heroui/react'

/**
 * A text area input for subjective question types (summary, translation, writing).
 * In normal mode, it provides an editable text area.
 * In revise mode, it displays the submitted answer as read-only.
 */
export function SubjectiveInput({ groupId, localNo, placeholder, maxLength }: {
    groupId: string
    localNo: number
    placeholder?: string
    maxLength?: number
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
            <div className='mt-2 p-3 bg-default-100 rounded-medium text-sm whitespace-pre-wrap min-h-20'>
                {currentAnswer || <span className='text-default-400 italic'>（未作答）</span>}
            </div>
        )
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
            className='mt-2'
            classNames={{
                input: 'text-sm',
            }}
        />
    )
}
