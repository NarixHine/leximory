'use client'

import { Drawer } from 'vaul'
import Comment from '@/components/comment'
import { useRef, useState } from 'react'
import { cn, getBracketedSelection, resetSelection } from '@/lib/utils'
import { PiMagnifyingGlass } from 'react-icons/pi'
import { AnimatePresence, motion } from 'framer-motion'
import { useEventListener } from 'usehooks-ts'
import { useIsMobileIos } from '@/lib/hooks'
import { CHINESE, ENGLISH } from '@/lib/fonts'

export default function Define() {
    const ref = useRef(globalThis.document)
    const [rect, setRect] = useState<DOMRect | null>(null)
    const [selection, setSelection] = useState<Selection | null>(null)

    useEventListener('selectionchange', () => {
        const newSelection = getSelection()
        if (!newSelection) {
            if (selection) {
                resetSelection()
            }
            return
        }
        setRect(newSelection.isCollapsed ? null : newSelection.getRangeAt(0).getBoundingClientRect())
        setSelection(newSelection)
    }, ref)

    const MotionTrigger = motion.create(Drawer.Trigger)
    const isMobileIos = useIsMobileIos()

    return <Drawer.Root>
        <AnimatePresence>
            {selection && selection.anchorNode?.textContent && selection.toString() && rect && <MotionTrigger
                style={{
                    left: rect.left + rect.width / 2,
                    top: scrollY + rect.bottom + 10
                }}
                initial={isMobileIos ? undefined : { opacity: 0 }}
                animate={isMobileIos ? undefined : { opacity: 1 }}
                exit={isMobileIos ? undefined : { opacity: 0, display: 'none' }}
                transition={isMobileIos ? undefined : { duration: 0.2 }}
                className={cn('absolute -translate-x-1/2 z-20 flex h-10 flex-shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full bg-white border border-gray-200 dark:border-gray-800 px-4 text-sm font-medium shadow-sm transition-all hover:bg-[#FAFAFA] dark:bg-[#161615] dark:hover:bg-[#1A1A19] dark:text-white', ENGLISH.className)}
            >
                <PiMagnifyingGlass />
                Define
            </MotionTrigger>}
        </AnimatePresence>
        <Drawer.Portal>
            <Drawer.Overlay className='fixed inset-0 z-50 bg-black/30' />
            <Drawer.Content className='h-fit fixed rounded-t-xl bottom-3 left-0 right-0 outline-none z-50 flex flex-col justify-center items-center mx-auto max-w-lg'>
                <Drawer.Title className='sr-only'>词汇注解</Drawer.Title>
                <Comment asCard prompt={selection && selection.anchorNode?.textContent && selection.toString() ? getBracketedSelection(selection) : ''} params='["", "🔄 加载中"]'></Comment>
            </Drawer.Content>
        </Drawer.Portal>
    </Drawer.Root>
}
