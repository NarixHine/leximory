'use client'

import { Drawer } from 'vaul'
import Comment from '@/components/comment'
import { useRef } from 'react'
import { cn } from '@/lib/utils'
import { PiMagnifyingGlass } from 'react-icons/pi'
import { AnimatePresence, motion } from 'framer-motion'
import { useIsMobileIos } from '@/lib/hooks'
import { getBracketedSelection, useSelection } from './utils'
import { getLanguageStrategy } from '@/lib/languages/strategies'
import { useAtomValue } from 'jotai'
import { langAtom } from '@/app/library/[lib]/atoms'
import { EmptyObject } from 'react-hook-form'
import { useOnClickOutside } from 'usehooks-ts'

export default function Define(props: { left: number | null, width: number | null, bottom: number | null, selection: Selection | null, container: HTMLElement | null, reset: () => void } | EmptyObject) {
    const ref = useRef(globalThis.document)
    const selectionContext = useSelection(ref)
    const { left, width, bottom, selection } = props && 'left' in props ? props : selectionContext
    const container = props && 'container' in props ? props.container : undefined
    const reset = props && 'reset' in props ? props.reset : () => { }
    const buttonRef = useRef<HTMLButtonElement>(null!)
    const lang = useAtomValue(langAtom)

    const MotionTrigger = motion.create(Drawer.Trigger)
    const isMobileIos = useIsMobileIos()
    const isEbookMode = !!container

    const { defineClassName, defineLabel } = getLanguageStrategy(lang)

    useOnClickOutside(buttonRef, () => {
        reset()
    })

    return <Drawer.Root repositionInputs={false} container={container}>
        <AnimatePresence>
            {selection && selection.anchorNode?.textContent && selection.toString() && left && width && bottom && <MotionTrigger
                ref={buttonRef}
                style={{
                    left: left + width / 2,
                    top: (isEbookMode ? 0 : scrollY) + bottom + 10
                }}
                initial={isMobileIos ? undefined : { opacity: 0 }}
                animate={isMobileIos ? undefined : { opacity: 1 }}
                exit={isMobileIos ? undefined : { opacity: 0, display: 'none' }}
                transition={isMobileIos ? undefined : { duration: 0.2 }}
                className={cn(
                    'absolute -translate-x-1/2 z-50 flex h-10 shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full bg-white border border-gray-200 dark:border-gray-800 px-4 text-sm font-medium shadow-sm transition-all hover:bg-[#FAFAFA] dark:bg-[#161615] dark:hover:bg-[#1A1A19] dark:text-white',
                    isEbookMode && 'opacity-90',
                    defineClassName
                )}
            >
                <PiMagnifyingGlass />
                {defineLabel}
            </MotionTrigger>}
        </AnimatePresence>
        <Drawer.Portal>
            <Drawer.Overlay className={cn(
                'fixed inset-0 z-60',
                'bg-linear-to-t to-transparent from-default-900/40',
            )} />
            <Drawer.Content className='h-fit px-2 fixed rounded-t-xl bottom-3 left-0 right-0 outline-none z-70 flex flex-col justify-center items-center mx-auto max-w-lg'>
                <Drawer.Title className='sr-only'>词汇注解</Drawer.Title>
                <Comment asCard prompt={selection && selection.anchorNode?.textContent && selection.toString() ? getBracketedSelection(selection) : ''} params='["", "↺ Loading ..."]'></Comment>
            </Drawer.Content>
        </Drawer.Portal>
    </Drawer.Root>
}
