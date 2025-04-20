'use client'

import { Drawer } from 'vaul'
import Comment from '@/components/comment'
import { useRef, useState } from 'react'
import { cn, getBracketedSelection, resetSelection } from '@/lib/utils'
import { PiMagnifyingGlassDuotone } from 'react-icons/pi'
import { AnimatePresence, motion } from 'framer-motion'
import { CHINESE_ZCOOL } from '@/lib/fonts'
import { useEventListener } from 'usehooks-ts'
import { langAtom, libAtom } from '@/app/library/[lib]/atoms'
import { useAtomValue } from 'jotai'
import { useIsMobileIos } from '@/lib/hooks'
export default function Define() {
    const ref = useRef(globalThis.document)
    const [rect, setRect] = useState<DOMRect | null>(null)
    const [selection, setSelection] = useState<Selection | null>(null)
    const lib = useAtomValue(libAtom)
    const lang = useAtomValue(langAtom)

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
                data-event='词汇注解'
                data-description={`进行了动态注解`}
                data-channel='annotation'
                data-tag-library={lib}
                data-tag-lang={lang}
                data-tag-context={'文章'}
                data-icon='🖊️'
                className={cn('absolute -translate-x-1/2 z-20 flex h-10 flex-shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full bg-white border border-gray-200 dark:border-gray-800 px-4 text-sm font-medium shadow-sm transition-all hover:bg-[#FAFAFA] dark:bg-[#161615] dark:hover:bg-[#1A1A19] dark:text-white', CHINESE_ZCOOL.className)}
            >
                <PiMagnifyingGlassDuotone />
                注解
            </MotionTrigger>}
        </AnimatePresence>
        <Drawer.Portal>
            <Drawer.Overlay className='fixed inset-0 bg-black/30 z-40' />
            <Drawer.Content className='h-fit fixed rounded-t-xl bottom-3 left-0 right-0 outline-none z-50 flex flex-col justify-center items-center mx-auto max-w-lg'>
                <Drawer.Title className='sr-only'>词汇注解</Drawer.Title>
                <Comment asCard prompt={selection && selection.anchorNode?.textContent && selection.toString() ? getBracketedSelection(selection) : ''} params='["", "🔄 加载中"]'></Comment>
            </Drawer.Content>
        </Drawer.Portal>
    </Drawer.Root>
}
