'use client'

import { Drawer } from 'vaul'
import Comment from '@/components/comment'
import { useState, useRef, RefObject } from 'react'
import { cn, getBracketedSelection } from '@/lib/utils'
import { PiMagnifyingGlassDuotone } from 'react-icons/pi'
import { motion } from 'framer-motion'
import { CHINESE_ZCOOL } from '@/lib/fonts'
import { useEventListener, useOnClickOutside } from 'usehooks-ts'

export default function Define() {
    const ref = useRef<HTMLDivElement>(null)
    const documentRef = useRef<Document>(globalThis.document)
    const [rect, setRect] = useState<DOMRect>()
    const [selection, setSelection] = useState<Selection | null>()

    useEventListener('selectionchange', () => {
        const selection = getSelection()
        if (selection && selection.rangeCount) {
            const range = selection.getRangeAt(0)
            const rect = range.getBoundingClientRect()
            setRect(rect)
        }
        setSelection(selection)
    }, documentRef)

    useOnClickOutside(ref as RefObject<HTMLElement>, () => {
        setSelection(null)
    })

    return selection && selection.anchorNode?.textContent && selection.toString() && <motion.div
        ref={ref}
        style={rect ? {
            left: rect.left + rect.width / 2,
            top: scrollY + rect.bottom + 10
        } : { display: 'none' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className='absolute -translate-x-1/2 z-20'
    >
        <Drawer.Root>
            <Drawer.Trigger
                className={cn('relative flex h-10 flex-shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full bg-white border border-gray-200 dark:border-gray-800 px-4 text-sm font-medium shadow-sm transition-all hover:bg-[#FAFAFA] dark:bg-[#161615] dark:hover:bg-[#1A1A19] dark:text-white', CHINESE_ZCOOL.className)}
            >
                <PiMagnifyingGlassDuotone />
                注解
            </Drawer.Trigger>
            <Drawer.Portal>
                <Drawer.Overlay className='fixed inset-0 bg-black/40' />
                <Drawer.Content className='h-fit fixed rounded-t-xl bottom-0 left-0 right-0 outline-none pb-16 bg-white dark:bg-slate-900 flex flex-col justify-center items-center mx-auto max-w-lg'>
                        <Comment asCard prompt={getBracketedSelection(selection)} params='["", "🔄 加载中"]'></Comment>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    </motion.div>
}
