'use client'

import { Button } from "@heroui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@heroui/popover"
import Comment from '@/components/comment'
import { useEffect, useState } from 'react'
import { cn, getBracketedSelection } from '@/lib/utils'
import { PiBroomDuotone, PiMagnifyingGlassDuotone } from 'react-icons/pi'
import { motion } from 'framer-motion'
import { CHINESE_ZCOOL } from '@/lib/fonts'

const useIsIOS = () => {
    return navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad') || navigator.userAgent.includes('Mac')
}

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

    const isIOS = useIsIOS()

    return selection && selection.anchorNode?.textContent && selection.toString() && <motion.div
        style={rect ? {
            left: rect.left + rect.width / 2,
            top: scrollY + rect.bottom + 10
        } : { display: 'none' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className='absolute -translate-x-1/2 z-20 flex justify-center items-center gap-2'
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

        {isIOS && <Button variant='flat' color='secondary' size='sm' radius='full' startContent={<PiBroomDuotone />} className='!size-6' isIconOnly onPress={() => {
            getSelection()?.empty()
            setSelection(null)
        }}></Button>}
    </motion.div>
}
