'use client'

import { Button } from "@heroui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@heroui/popover"
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
        <Popover placement='right'>
            <PopoverTrigger>
                <Button
                    className={cn('flex-1', CHINESE_ZCOOL.className)}
                    data-umami-event='词汇注解'
                    color='primary'
                    variant='shadow'
                    radius='full'
                    size='sm'
                    startContent={<PiMagnifyingGlassDuotone />}
                >
                    注解
                </Button>
            </PopoverTrigger>
            <PopoverContent className='sm:w-80 w-60 p-0 bg-transparent'>
                <Comment asCard prompt={getBracketedSelection(selection)} params='["", "🔄 加载中"]'></Comment>
            </PopoverContent>
        </Popover>
    </motion.div>
}
