'use client'

import { CardBody, Button, User, CardFooter } from '@heroui/react'
import { PiFireDuotone, PiTrash } from 'react-icons/pi'
import { useTransition } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { deleteMemoryAction } from '../actions'
import { momentSH } from '@/lib/moment'
import FlatCard from '@/components/ui/flat-card'
import Markdown from '@/components/markdown'
import Link from 'next/link'

type Memory = {
    id: number
    content: string
    created_at: string
    public: boolean
    streak: boolean
    creator: {
        id: string
        username: string | null
        avatar_url: string | null
    }
}

export function MemoryCard({ memory }: { memory: Memory }) {
    const [isPending, startTransition] = useTransition()
    const queryClient = useQueryClient()

    function handleDelete() {
        startTransition(async () => {
            await deleteMemoryAction({ id: memory.id })
            queryClient.invalidateQueries({ queryKey: ['personal-memories'] })
            queryClient.invalidateQueries({ queryKey: ['federated-memories'] })
        })
    }

    return (
        <FlatCard background='solid' className='p-4'>
            <CardBody>
                <div className='flex flex-col gap-4'>
                    <div className='flex items-center justify-between'>
                        <Button
                            as={Link}
                            className='pl-0 pr-2 rounded-l-full rounded-r-lg'
                            href={`/profile/${memory.creator.id}`}
                            variant='light'
                            startContent={<User
                                name={memory.creator.username ?? 'User'}
                                description={momentSH(memory.created_at).calendar()}
                                avatarProps={{
                                    src: memory.creator.avatar_url ?? ''
                                }}
                            />}
                        ></Button>
                        <Button
                            isIconOnly
                            size='sm'
                            variant='light'
                            onPress={handleDelete}
                            isLoading={isPending}
                        >
                            <PiTrash />
                        </Button>
                    </div>
                    <Markdown md={memory.content} />
                </div>
            </CardBody>
            {memory.streak && <CardFooter className='flex justify-end mt-0 pt-0'>
                <PiFireDuotone className='text-orange-500 size-5' />
            </CardFooter>}
        </FlatCard>
    )
}
