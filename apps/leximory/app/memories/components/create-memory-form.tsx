'use client'

import { useTransition } from 'react'
import { createMemoryAction } from '../actions'
import { MemoryEditor } from './memory-editor'
import { toast } from 'sonner'
import FlatCard from '@/components/ui/flat-card'
import { useQueryClient } from '@tanstack/react-query'
import { CardProps } from '@heroui/card'
import { cn } from '@/lib/utils'

export function CreateMemoryForm({ className }: { className?: CardProps['className'] }) {
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
        <FlatCard background={'solid'} className={cn('p-5 w-full', className)}>
            <MemoryEditor
                onSave={handleSave}
                isSaving={isPending}
            />
        </FlatCard>
    )
}