'use client'

import { useAtomValue } from 'jotai'
import { feedbackAtom, editoryItemsAtom } from '@repo/ui/paper/atoms'
import { SUBJECTIVE_TYPES } from '@repo/schema/paper'
import { AppealButton } from './subjective-feedback/appeal'

/**
 * Renders appeal buttons for each subjective section that has feedback.
 * Placed inline after the paper rendering.
 */
export function SubjectiveAppealButtons() {
    const feedback = useAtomValue(feedbackAtom)
    const quizData = useAtomValue(editoryItemsAtom)

    if (!feedback) return null

    const subjectiveSections = quizData.filter(
        (section) => (SUBJECTIVE_TYPES as readonly string[]).includes(section.type)
    )

    const sectionsWithFeedback = subjectiveSections.filter(s => feedback[s.id])
    if (sectionsWithFeedback.length === 0) return null

    return (
        <div className='flex flex-wrap gap-2 mt-4'>
            {sectionsWithFeedback.map((section) => {
                const sectionFeedback = feedback[section.id]!
                return (
                    <AppealButton
                        key={section.id}
                        sectionId={section.id}
                        sectionType={sectionFeedback.type}
                        feedback={sectionFeedback}
                    />
                )
            })}
        </div>
    )
}
