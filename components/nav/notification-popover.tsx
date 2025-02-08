'use client'

import { Badge } from '@heroui/badge'
import { Button } from '@heroui/button'
import { Popover, PopoverTrigger, PopoverContent } from '@heroui/popover'
import { PiBellDuotone, PiExclamationMarkLight } from 'react-icons/pi'
import { lastOpenDateAtom } from './atoms'
import { useAtom } from 'jotai'
import moment from 'moment'
import { useState } from 'react'
import Markdown from '../markdown'
import { useIsClient } from 'usehooks-ts'
import { zNotices } from '@/server/db/config'
import { z } from 'zod'

export default function NotificationPopover({ notices }: { notices: z.infer<typeof zNotices> }) {
    const [lastOpenDate, setLastOpenDate] = useAtom(lastOpenDateAtom)
    const [isOpen, setIsOpen] = useState(false)
    const handleOpen = () => {
        setLastOpenDate(new Date().toISOString())
        setIsOpen(!isOpen)
    }
    const isNew = notices.some(notice => moment(notice.date).isAfter(moment(lastOpenDate)))
    const isClient = useIsClient()

    return (
        <Popover isOpen={isOpen} onOpenChange={handleOpen}>
            <PopoverTrigger>
                <Badge shape='circle' variant='flat' color='primary' content={<PiExclamationMarkLight />} isInvisible={!isClient || !isNew}>
                    <Button
                        onPress={handleOpen}
                        isIconOnly
                        variant='flat'
                        color='primary'
                        radius='full'
                        size='sm'
                        className='opacity-80 backdrop-blur-sm'
                        startContent={<PiBellDuotone className='text-lg' />}
                    />
                </Badge>
            </PopoverTrigger>
            <PopoverContent className='w-80'>
                <div className='max-h-96 overflow-y-auto py-2'>
                    {notices.length === 0 ? (
                        <p className='p-4 text-sm'>No notifications</p>
                    ) : (
                        <div>
                            {notices.map((notice) => <div
                                key={notice.message}
                                className={`p-4 hover:bg-default-50/60 transition-colors duration-200 rounded-xl`}
                            >
                                <Markdown md={notice.message} />
                                <p className='text-xs opacity-70 mt-1'>{moment(notice.date).format('ll')}</p>
                            </div>
                            )}
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
} 
