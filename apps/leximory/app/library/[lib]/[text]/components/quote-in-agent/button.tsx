'use client'

import { Button } from '@heroui/react'
import { PiChatsDuotone } from 'react-icons/pi'
import ChatInterface from '@/app/library/chat/components/chat-interface'
import { useAtomValue } from 'jotai'
import { textAtom, promptAtom, isEditingAtom } from '../../atoms'
import { Drawer } from 'vaul'

export default function QuoteInAgentButton({ className }: { className?: string }) {
    const isEditing = useAtomValue(isEditingAtom)
    const text = useAtomValue(textAtom)
    const prompt = useAtomValue(promptAtom)
    return isEditing ? null : (
        <Drawer.Root>
            <Drawer.Trigger asChild>
                <Button
                    isIconOnly
                    variant='light'
                    className={className}
                    startContent={<PiChatsDuotone />}
                />
            </Drawer.Trigger>
            <Drawer.Portal>
                <Drawer.Overlay className='fixed inset-0 bg-black/40 dark:bg-white/5' />
                <Drawer.Content className='h-[95dvh] z-999 fixed rounded-t-xl bottom-0 left-0 right-0 outline-none bg-background flex flex-col justify-center items-center'>
                    <Drawer.Title className='sr-only'>Talk to Your Library</Drawer.Title>
                    <div className='w-full h-full overflow-y-auto'>
                        <ChatInterface initialInput={`对于文本［ID: ${text}］，${prompt}`} shouldOpenNew />
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    )
}
