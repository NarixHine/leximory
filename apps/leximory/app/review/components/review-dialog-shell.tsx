'use client'

import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Card, CardBody } from '@heroui/card'
import { cn } from '@/lib/utils'

interface ReviewDialogShellProps {
    isOpen: boolean
    children: ReactNode
    className?: string
    cardClassName?: string
}

export function ReviewDialogShell({
    isOpen,
    children,
    className,
    cardClassName,
}: ReviewDialogShellProps) {
    return (
        <AnimatePresence>
            {isOpen ? (
                <motion.div
                    initial={{ opacity: 0, y: -20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className={cn('fixed top-24 left-1/2 z-50 w-full max-w-xl -translate-x-1/2 px-4', className)}
                >
                    <Card shadow='none' className={cn('rounded-4xl border-7 shadow-none backdrop-blur', cardClassName)}>
                        <CardBody className='gap-4'>
                            {children}
                        </CardBody>
                    </Card>
                </motion.div>
            ) : null}
        </AnimatePresence>
    )
}
