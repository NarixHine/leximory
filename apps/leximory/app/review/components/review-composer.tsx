'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '@heroui/button'
import { PiArrowUp } from 'react-icons/pi'
import { cn } from '@/lib/utils'

interface ReviewComposerProps {
    isOpen: boolean
    value: string
    onChange: (value: string) => void
    onSubmit: () => void
    placeholder: string
    disabled?: boolean
    canSubmit?: boolean
    isLoading?: boolean
    rows?: number
    className?: string
    textareaClassName?: string
}

export function ReviewComposer({
    isOpen,
    value,
    onChange,
    onSubmit,
    placeholder,
    disabled,
    canSubmit,
    isLoading,
    rows = 2,
    className,
    textareaClassName,
}: ReviewComposerProps) {
    return (
        <AnimatePresence>
            {isOpen ? (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className='fixed bottom-6 left-0 right-0 z-50 px-4'
                >
                    <div className='mx-auto max-w-2xl'>
                        <div className={cn('rounded-4xl border p-3 pt-2', className)}>
                            <textarea
                                value={value}
                                onChange={(event) => onChange(event.target.value)}
                                className={cn(
                                    'w-full resize-none border-0 bg-transparent px-3 py-2 focus:outline-none',
                                    textareaClassName
                                )}
                                rows={rows}
                                placeholder={placeholder}
                                disabled={disabled}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' && !event.shiftKey) {
                                        event.preventDefault()
                                        onSubmit()
                                    }
                                }}
                            />
                            <div className='mt-2 flex justify-end pt-2'>
                                <Button
                                    isIconOnly
                                    color='primary'
                                    radius='full'
                                    size='sm'
                                    onPress={onSubmit}
                                    isLoading={isLoading}
                                    isDisabled={!canSubmit}
                                >
                                    <PiArrowUp className='h-4 w-4' />
                                </Button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            ) : null}
        </AnimatePresence>
    )
}
