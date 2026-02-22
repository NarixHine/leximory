'use client'

import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'
import { FormProps, Form as HeroUIForm } from "@heroui/form"
import { Button } from "@heroui/button"
import { DrawerBody, DrawerFooter, DrawerHeader, DrawerContent, Drawer } from "@heroui/drawer"
import { PiFloppyDisk } from 'react-icons/pi'

export default function Form({ isOpen, onOpenChange, children, className, isLoading, onSubmit, title, actionButton, ...props }: { isOpen: boolean, onOpenChange: (open: boolean) => void, title: string, children: ReactNode, isLoading: boolean, actionButton?: ReactNode } & FormProps) {
    return <Drawer hideCloseButton placement='bottom' motionProps={{
        variants: {
            enter: {
                y: 0,
                opacity: 1,
                transition: {
                    duration: 0.5,
                    ease: [0.32, 0.72, 0, 1]
                },
            },
            exit: {
                y: '100%',
                opacity: 0,
                transition: {
                    duration: 0.5,
                    ease: [0.32, 0.72, 0, 1]
                },
            },
        },
    }} className='bg-default-50' isOpen={isOpen} onOpenChange={onOpenChange}>
        <DrawerContent className='max-h-dvh rounded-4xl'>
            {(onClose) => (
                <HeroUIForm onSubmit={async (props) => {
                    await onSubmit?.(props)
                    onClose()
                }} className={cn('max-w-(--breakpoint-sm) mx-auto py-3', className)} {...props}>
                    <DrawerHeader className='flex flex-col gap-1'>{title}</DrawerHeader>
                    <DrawerBody>
                        {children}
                    </DrawerBody>
                    <DrawerFooter className='flex gap-2 w-full pt-0'>
                        <div className='flex-1'></div>
                        {actionButton}
                        <Button type='submit' color='primary' startContent={isLoading ? null : <PiFloppyDisk />} isLoading={isLoading}>确认</Button>
                    </DrawerFooter>
                </HeroUIForm>
            )}
        </DrawerContent>
    </Drawer>
}
