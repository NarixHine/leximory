'use client'

import { Button } from '@nextui-org/button'
import { Popover, PopoverContent, PopoverTrigger } from '@nextui-org/popover'
import Comment from '@/components/comment'
import { useEffect, useState } from 'react'
import { cn, getBracketedSelection } from '@/lib/utils'
import { PiMagnifyingGlassDuotone } from 'react-icons/pi'
import { motion } from 'framer-motion'
import { CHINESE_ZCOOL } from '@/lib/fonts'

export default function Define() {
    const [rect, setRect] = useState<DOMRect>()
    const [selection, setSelection] = useState<Selection | null>()
    useEffect(() => {
        const handleSelectionChange = () => {
            const selection = getSelection()
            if (selection && selection.rangeCount) {
                const range = selection.getRangeAt(0)
                const rect = range.getBoundingClientRect()
                setRect(rect)
            }
            setTimeout(() => {
                setSelection(selection)
            })
        }
        document.addEventListener('selectionchange', handleSelectionChange)
        return () => {
            document.removeEventListener('selectionchange', handleSelectionChange)
        }
    }, [])

    const MotionButton = motion(Button)

    return selection && selection.anchorNode?.textContent && selection.toString() && <Popover placement='right'>
        <PopoverTrigger>
            <MotionButton
                className={cn('absolute -translate-x-1/2 z-20', CHINESE_ZCOOL.className)}
                data-umami-event='词汇注解'
                style={rect ? {
                    left: rect.left + rect.width / 2,
                    top: scrollY + rect.bottom + 10
                } : { display: 'none' }}
                color='primary'
                variant='flat'
                radius='full'
                size='sm'
                startContent={<PiMagnifyingGlassDuotone />}
            >
                注解
            </MotionButton>
        </PopoverTrigger>
        <PopoverContent className='sm:w-80 w-60 p-0 bg-transparent'>
            <Comment asCard prompt={getBracketedSelection(selection)} params='["", "🔄 加载中"]'></Comment>
        </PopoverContent>
    </Popover>
}
