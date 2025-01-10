'use client'

import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'
import { FormProps, Form as NextUIForm } from '@nextui-org/form'
import { Button } from '@nextui-org/button'
import { DrawerBody, DrawerFooter, DrawerHeader, DrawerContent, Drawer } from '@nextui-org/drawer'
import { PiFloppyDiskDuotone } from 'react-icons/pi'

export default function Form({ isOpen, onOpenChange, children, className, isLoading, onSubmit, title, actionButton, ...props }: { isOpen: boolean, onOpenChange: (open: boolean) => void, title: string, children: ReactNode, isLoading: boolean, actionButton?: ReactNode } & FormProps) {
    return <Drawer placement='top' isOpen={isOpen} onOpenChange={onOpenChange}>
        <DrawerContent>
            {(onClose) => (
                <NextUIForm onSubmit={async (props) => {
                    await onSubmit?.(props)
                    onClose()
                }} className={cn('max-w-screen-sm mx-auto py-3', className)} {...props}>
                    <DrawerHeader className='flex flex-col gap-1'>{title}</DrawerHeader>
                    <DrawerBody>
                        {children}
                    </DrawerBody>
                    <DrawerFooter className='flex gap-2 w-full'>
                        <div className='flex-1'></div>
                        <Button type='submit' color='primary' variant='flat' startContent={isLoading ? null : <PiFloppyDiskDuotone />} isLoading={isLoading}>确认</Button>
                        {actionButton}
                    </DrawerFooter>
                </NextUIForm>
            )}
        </DrawerContent>
    </Drawer>
}
