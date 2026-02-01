'use client'

import { Popover, PopoverContent, PopoverTrigger } from '@heroui/react'

export function ConfirmPopover({ actionButton, children, skipConfirm }: { actionButton: React.ReactNode, children: React.ReactNode, skipConfirm?: boolean }) {
    return skipConfirm ? actionButton : (
        <Popover>
            <PopoverTrigger>
                {children}
            </PopoverTrigger>
            <PopoverContent className='p-0'>
                {actionButton}
            </PopoverContent>
        </Popover>
    )
}
