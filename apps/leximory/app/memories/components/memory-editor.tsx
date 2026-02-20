'use client'

import { Button, Textarea, Switch } from '@heroui/react'
import { useState, useEffect } from 'react'
import { PiFire, PiGlobeHemisphereEast, PiPaperPlaneTilt } from 'react-icons/pi'

type MemoryEditorProps = {
    initialContent?: string
    initialIsPublic?: boolean
    initialIsStreak?: boolean
    onSave: (data: { content: string; isPublic: boolean; isStreak: boolean }) => void
    isSaving: boolean
}

export function MemoryEditor({
    initialContent = '',
    initialIsPublic = false,
    initialIsStreak = false,
    onSave,
    isSaving,
}: MemoryEditorProps) {
    const [content, setContent] = useState(initialContent)
    const [isPublic, setIsPublic] = useState(initialIsPublic)
    const [isStreak, setIsStreak] = useState(initialIsStreak)

    useEffect(() => {
        setContent(initialContent)
    }, [initialContent])

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        onSave({ content, isPublic, isStreak })
    }

    return (
        <form onSubmit={handleSubmit} className='flex flex-col gap-4 w-full'>
            <Textarea
                label={'What\'s your memory today?!'}
                value={content}
                onValueChange={setContent}
                required
                fullWidth
            />
            <div className='flex gap-4'>
                <Switch thumbIcon={<PiGlobeHemisphereEast />} isSelected={isPublic} onValueChange={setIsPublic}>
                    Public
                </Switch>
                <Switch thumbIcon={<PiFire />} isSelected={isStreak} onValueChange={setIsStreak}>
                    Streak
                </Switch>
            </div>
            <div className='flex justify-end gap-2'>
                <Button
                    type='submit'
                    isLoading={isSaving}
                    color='primary'
                    startContent={<PiPaperPlaneTilt />}
                    isIconOnly
                />
            </div>
        </form>
    )
}