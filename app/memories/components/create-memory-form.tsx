'use client'

import { useTransition } from 'react'
import { createMemoryAction } from '../actions'
import { MemoryEditor } from './memory-editor'
import { toast } from 'sonner'
import FlatCard from '@/components/ui/flat-card'
import { useQueryClient } from '@tanstack/react-query'

export function CreateMemoryForm() {
    const [isPending, startTransition] = useTransition()
    const queryClient = useQueryClient()

    function handleSave(data: { content: string; isPublic: boolean; isStreak: boolean }) {
        startTransition(async () => {
            await createMemoryAction(data)
            toast.success('Memory 已创建！')
            queryClient.invalidateQueries({ queryKey: ['personal-memories'] })
            queryClient.invalidateQueries({ queryKey: ['federated-memories'] })

        })
    }

    return (
        <FlatCard className='p-5 w-full'>
            <MemoryEditor
                onSave={handleSave}
                isSaving={isPending}
            />
        </FlatCard>
    )
}