'use client'

import { type ReactNode, useEffect, useState } from 'react'
import { useLinkStatus } from 'next/link'
import { Spinner, SpinnerProps } from '@heroui/spinner'
import { AnimatePresence, motion, Transition } from 'framer-motion'

const springTransition: Transition<'spring'> = {
    type: 'spring',
    duration: 0.5,
    mass: 0.5,
}

const variants = {
    initial: { opacity: 0, filter: 'blur(3px)', scale: 0 },
    animate: { opacity: 1, filter: 'blur(0px)', scale: 1 },
    exit: { opacity: 0, filter: 'blur(3px)', scale: 0 },
}

export default function LoadingIndicatorWrapper({ children, ...props }: { children: ReactNode } & SpinnerProps) {
    const { pending } = useLinkStatus()
    const [currentState, setCurrentState] = useState(pending ? 'spinner' : 'children')

    useEffect(() => {
        // Defensive state management to prevent coexistence
        const newState = pending ? 'spinner' : 'children'
        if (newState !== currentState) {
            setCurrentState(newState)
        }
    }, [pending, currentState])

    return (
        <AnimatePresence mode='popLayout' initial={false}>
            {currentState === 'spinner' ? (
                <motion.span
                    key='spinner'
                    variants={variants}
                    initial='initial'
                    animate='animate'
                    exit='exit'
                    transition={springTransition}
                    style={{ display: 'inline-flex' }}
                >
                    <Spinner size='sm' {...props} />
                </motion.span>
            ) : (
                <motion.span
                    key='children'
                    variants={variants}
                    initial='initial'
                    animate='animate'
                    exit='exit'
                    transition={springTransition}
                    style={{ display: 'inline-flex' }}
                >
                    {children}
                </motion.span>
            )}
        </AnimatePresence>
    )
}
