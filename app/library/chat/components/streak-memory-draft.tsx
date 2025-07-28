'use client'

import { useTransition } from 'react'
import { createMemoryAction } from '@/app/memories/actions'
import { toast } from 'sonner'
import FlatCard from '@/components/ui/flat-card'
import { MemoryEditor } from '@/app/memories/components/memory-editor'
import { User } from '@heroui/react'
import { momentSH } from '@/lib/moment'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

type StreakMemoryDraftProps = {
    content: string
    user: {
        id: string
        username: string | undefined
        avatar_url: string | undefined
    }
}

export function StreakMemoryDraft({ content, user }: StreakMemoryDraftProps) {
    const [isPublishing, startPublishing] = useTransition()
    const queryClient = useQueryClient()
    const router = useRouter()

    function handlePublish(data: { content: string; isPublic: boolean; isStreak: boolean }) {
        startPublishing(async () => {
            await createMemoryAction(data)
            toast.success('Memory 已发布！', {
                action: {
                    onClick() {
                        router.push('/memories')
                    },
                    label: '查看'
                }
            })
            queryClient.invalidateQueries({ queryKey: ['personal-memories'] })
            queryClient.invalidateQueries({ queryKey: ['federated-memories'] })
        })
    }

    return (
        <FlatCard background='solid' className='p-5 w-full'>
            <div className="flex flex-col gap-4">
                <User
                    name={user.username ?? 'User'}
                    description={momentSH().fromNow()}
                    avatarProps={{
                        src: user.avatar_url ?? ''
                    }}
                    className='self-start'
                />
                <MemoryEditor
                    initialContent={content}
                    onSave={handlePublish}
                    initialIsPublic={false}
                    initialIsStreak={true}
                    isSaving={isPublishing}
                />
            </div>
        </FlatCard>
    )
}