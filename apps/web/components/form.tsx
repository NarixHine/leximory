'use client'

import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'
import { FormProps, Form as HeroUIForm } from "@heroui/form"
import { Button } from "@heroui/button"
import { DrawerBody, DrawerFooter, DrawerHeader, DrawerContent, Drawer } from "@heroui/drawer"
import { PiFloppyDiskDuotone } from 'react-icons/pi'

export default function Form({ isOpen, onOpenChange, children, className, isLoading, onSubmit, title, actionButton, ...props }: { isOpen: boolean, onOpenChange: (open: boolean) => void, title: string, children: ReactNode, isLoading: boolean, actionButton?: ReactNode } & FormProps) {
    return <Drawer placement='bottom' className='bg-default-50' isOpen={isOpen} onOpenChange={onOpenChange}>
        <DrawerContent>
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
                        <Button type='submit' color='primary' variant='flat' startContent={isLoading ? null : <PiFloppyDiskDuotone />} isLoading={isLoading}>确认</Button>
                        {actionButton}
                    </DrawerFooter>
                </HeroUIForm>
            )}
        </DrawerContent>
    </Drawer>
}
