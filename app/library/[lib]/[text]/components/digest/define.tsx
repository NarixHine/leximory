'use client'

import { Drawer } from 'vaul'
import Comment from '@/components/comment'
import { useRef, useState } from 'react'
import { cn, getBracketedSelection } from '@/lib/utils'
import { PiMagnifyingGlassDuotone } from 'react-icons/pi'
import { motion } from 'framer-motion'
import { CHINESE_ZCOOL } from '@/lib/fonts'
import { useEventListener } from 'usehooks-ts'
import { langAtom, libAtom } from '@/app/library/[lib]/atoms'
import { useAtomValue } from 'jotai'

export default function Define() {
    const ref = useRef(globalThis.document)
    const [rect, setRect] = useState<DOMRect | null>(null)
    const [selection, setSelection] = useState<Selection | null>(null)
    const lib = useAtomValue(libAtom)
    const lang = useAtomValue(langAtom)

    useEventListener('selectionchange', () => {
        const selection = getSelection()
        if (selection && selection.rangeCount) {
            const range = selection.getRangeAt(0)
            const rect = range.getBoundingClientRect()
            setRect(rect)
            setSelection(selection)
        }
    }, ref)

    return <motion.div
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
            {selection && selection.anchorNode?.textContent && selection.toString() && <Drawer.Trigger
                data-event='词汇注解'
                data-description={`动态注解了 ${selection.toString()}`}
                data-channel='annotation'
                data-tag-library={lib}
                data-tag-lang={lang}
                data-tag-context={'文章'}
                data-icon='🖊️'
                className={cn('relative flex h-10 flex-shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full bg-white border border-gray-200 dark:border-gray-800 px-4 text-sm font-medium shadow-sm transition-all hover:bg-[#FAFAFA] dark:bg-[#161615] dark:hover:bg-[#1A1A19] dark:text-white', CHINESE_ZCOOL.className)}
            >
                <PiMagnifyingGlassDuotone />
                注解
            </Drawer.Trigger>}
            <Drawer.Portal>
                <Drawer.Overlay className='fixed inset-0 bg-black/40 z-40' />
                <Drawer.Content className='h-fit fixed rounded-t-xl bottom-0 left-0 right-0 outline-none pb-10 z-50 flex flex-col justify-center items-center mx-auto max-w-lg'>
                    {selection && selection.anchorNode?.textContent && selection.toString() && <Comment asCard prompt={getBracketedSelection(selection)} params='["", "🔄 加载中"]'></Comment>}
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    </motion.div>
}
