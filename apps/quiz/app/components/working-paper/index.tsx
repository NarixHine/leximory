'use client'

import { useEffect, useEffectEvent } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { addWorkingPaperAtom, removeWorkingPaperAtom, workingPapersAtom } from './atoms'
import { Card, CardBody } from '@heroui/card'
import { Spacer } from '@heroui/spacer'
import { Button } from '@heroui/button'
import { CalendarSlashIcon, CheckCircleIcon } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'

export function AddWorkingPaper({ id, title }: { id: number, title: string }) {
    const addWorkingPaper = useSetAtom(addWorkingPaperAtom)

    const add = useEffectEvent(({ id, title }: { id: number, title: string }) => {
        addWorkingPaper({ id, title })
    })
    useEffect(() => {
        add({ id, title })
    }, [id, title])

    return null
}

export function WorkingPapers() {
    const papers = useAtomValue(workingPapersAtom)
    const removeWorkingPaper = useSetAtom(removeWorkingPaperAtom)
    const router = useRouter()
    return papers.length > 0 ? (
        <>
            <h2 className='font-formal text-4xl block'>你在做</h2>
            <section className='flex flex-wrap gap-3'>
                {papers.map(({ id, title, isCompleted }) => (
                    <Card key={id} isPressable shadow='none' className='rounded-3xl' onPress={() => {
                        router.push(`/paper/${id}`)
                    }}>
                        <CardBody className='py-3 pl-4 pr-3 flex flex-row items-center gap-2 relative'>
                            {isCompleted && <CheckCircleIcon className='inline-block size-5' />}
                            <div className='text-2xl font-formal text-pretty'>{title}</div>
                            <Button
                                size='sm'
                                variant='flat'
                                radius='full'
                                startContent={<CalendarSlashIcon weight='duotone' />}
                                onPress={() => removeWorkingPaper(id)}
                                className='shrink-0'
                            >
                                移出「你在做」
                            </Button>
                        </CardBody>
                    </Card>
                ))}
            </section>
            <Spacer y={1} />
        </>
    ) : null
}
