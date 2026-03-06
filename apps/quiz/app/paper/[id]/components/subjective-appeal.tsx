'use client'

import { useEffect } from 'react'
import { useSetAtom } from 'jotai'
import { appealRendererAtom } from '@repo/ui/paper/atoms'
import { AppealButton } from './subjective-feedback/appeal'

/**
 * Sets the appealRendererAtom so that SubjectiveSectionFooter can render
 * AppealButton within each section's feedback area.
 */
export function SetAppealRenderer() {
    const setAppealRenderer = useSetAtom(appealRendererAtom)

    useEffect(() => {
        setAppealRenderer(() => ({ sectionId, sectionType, feedback }: { sectionId: string, sectionType: string, feedback: any }) => (
            <AppealButton sectionId={sectionId} sectionType={sectionType} feedback={feedback} />
        ))
        return () => setAppealRenderer(null)
    }, [setAppealRenderer])

    return null
}
