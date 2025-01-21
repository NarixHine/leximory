'use client'

import { Drawer } from 'vaul'
import Comment from '@/components/comment'
import { useState, useRef } from 'react'
import { cn, getBracketedSelection } from '@/lib/utils'
import { PiMagnifyingGlassDuotone } from 'react-icons/pi'
import { motion } from 'framer-motion'
import { CHINESE_ZCOOL } from '@/lib/fonts'
import { useEventListener } from 'usehooks-ts'
import Image from 'next/image'
import logo from '@/app/icon.png'

export default function Define() {
    const documentRef = useRef<Document>(globalThis.document)
    const [open, setOpen] = useState(false)
    const [rect, setRect] = useState<DOMRect>()
    const [selection, setSelection] = useState<Selection | null>()

    useEventListener('selectionchange', () => {
        if (open) return
        const selection = getSelection()
        if (selection && selection.rangeCount) {
            const range = selection.getRangeAt(0)
            const rect = range.getBoundingClientRect()
            setRect(rect)
        }
        setSelection(selection)
    }, documentRef)

    const Trigger = motion(Drawer.Trigger)

    return <Drawer.Root open={open} onOpenChange={setOpen}>
        {selection && selection.anchorNode?.textContent && selection.toString() && <Trigger
            style={rect ? {
                left: rect.left + rect.width / 2,
                top: scrollY + rect.bottom + 10
            } : { display: 'none' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={cn('absolute -translate-x-1/2 z-20 flex h-10 flex-shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full bg-white border border-gray-200 dark:border-gray-800 px-4 text-sm font-medium shadow-sm transition-all hover:bg-[#FAFAFA] dark:bg-[#161615] dark:hover:bg-[#1A1A19] dark:text-white', CHINESE_ZCOOL.className)}
        >
            <PiMagnifyingGlassDuotone />
            注解
        </Trigger>}
        <Drawer.Portal>
            <Drawer.Overlay className='fixed inset-0 bg-black/40 z-40' />
            <Drawer.Content className='h-fit fixed rounded-t-xl bottom-0 left-0 right-0 outline-none bg-white dark:bg-slate-900 flex flex-col justify-center items-center mx-auto max-w-md z-50'>
                {selection && selection.anchorNode?.textContent && selection.toString() &&  && <Comment asCard prompt={getBracketedSelection(selection)} params='["", "🔄 加载中"]'></Comment>}
                <Logo />
            </Drawer.Content>
        </Drawer.Portal>
    </Drawer.Root>
}

const Logo = () => <div className='flex justify-center items-center p-4 pt-0'><Image src={logo} alt='logo' quality={100} /></div>
