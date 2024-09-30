'use client'

import { Button, Popover, PopoverContent, PopoverTrigger } from '@nextui-org/react'
import Comment from '@/components/comment'
import { useEffect, useState } from 'react'
import { getSelectedText } from '@/lib/utils'
import { PiMagnifyingGlassDuotone } from 'react-icons/pi'

export default function Define() {
    const [rect, setRect] = useState<DOMRect>()
    const [selection, setSelection] = useState<Selection | null>()
    useEffect(() => {
        document.addEventListener('selectionchange', () => {
            const selection = getSelection()
            if (selection && selection.rangeCount) {
                const range = selection.getRangeAt(0)
                const rect = range.getBoundingClientRect()
                setRect(rect)
            }
            setTimeout(() => {
                setSelection(selection)
            }, 100)
        })
    }, [])
    return selection && selection.anchorNode?.textContent && selection.toString() && <Popover placement='right'>
        <PopoverTrigger>
            <Button
                data-umami-event='词汇注解'
                className='absolute -translate-x-1/2'
                style={rect ? {
                    left: rect.left + rect.width / 2,
                    top: scrollY + rect.bottom + 10
                } : { display: 'none' }}
                color='secondary'
                variant='solid'
                radius='sm'
                size='sm'
                startContent={<PiMagnifyingGlassDuotone />}
            >
                注解
            </Button>
        </PopoverTrigger>
        <PopoverContent className='sm:w-80 w-60 p-0 bg-transparent'>
            <Comment asCard prompt={getSelectedText(selection)} params='["", "🔄 加载中"]'></Comment>
        </PopoverContent>
    </Popover>
}
