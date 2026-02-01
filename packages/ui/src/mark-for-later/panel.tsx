'use client'

import { markedItemsAtom, removeMarkedItemAtom, clearMarkedItemsAtom, type MarkedItem } from '../paper/atoms'
import { useAtomValue, useSetAtom } from 'jotai'
import { Button } from '@heroui/react'
import { BookmarkSimpleIcon, TrashIcon, XIcon } from '@phosphor-icons/react'
import { toast } from 'sonner'

export function MarkedItemsPanel() {
    const markedItems = useAtomValue(markedItemsAtom)
    const removeMarkedItem = useSetAtom(removeMarkedItemAtom)
    const clearMarkedItems = useSetAtom(clearMarkedItemsAtom)

    if (markedItems.length === 0) {
        return null
    }

    return (
        <div className='mb-4 rounded-xl bg-default-50 dark:bg-default-100/50 border border-default-200 dark:border-default-300 px-5 pt-3 pb-4'>
            <div className='flex items-center justify-between'>
                <div className='flex items-center gap-1 mb-1'>
                    <BookmarkSimpleIcon className='size-4 text-secondary' />
                    <span className='text-sm font-medium'>标记词汇</span>
                    <span className='text-xs text-default-500 font-mono'>({markedItems.length})</span>
                </div>
                <Button
                    isIconOnly
                    size='sm'
                    variant='light'
                    color='danger'
                    onPress={() => {
                        clearMarkedItems()
                        toast.success('已清除所有标记')
                    }}
                >
                    <TrashIcon weight='duotone' className='size-3' />
                </Button>
            </div>
            <div className='flex flex-wrap gap-2'>
                {markedItems.map((item) => (
                    <MarkedItemButton
                        key={item.id}
                        item={item}
                        onRemove={() => removeMarkedItem({ id: item.id })}
                    />
                ))}
            </div>
        </div>
    )
}

function MarkedItemButton({ item, onRemove }: { item: MarkedItem, onRemove: () => void }) {
    const handleJump = () => {
        const element = getElementByXPath(item.xpath)
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' })
            // Highlight element temporarily
            element.classList.add('ring-2', 'ring-default', 'ring-offset-2')
            setTimeout(() => {
                element.classList.remove('ring-2', 'ring-default', 'ring-offset-2')
            }, 2000)
        } else {
            toast.error('无法跳转到该位置')
        }
    }

    return (
        <div className='group relative'>
            <Button
                size='sm'
                variant='flat'
                color='secondary'
                className='h-8 px-3 text-xs'
                onPress={handleJump}
            >
                {item.text}
            </Button>
            <Button
                isIconOnly
                size='sm'
                variant='light'
                color='danger'
                className='absolute -top-1 -right-1 size-4 min-w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity'
                onPress={onRemove}
            >
                <XIcon weight='duotone' className='size-2' />
            </Button>
        </div>
    )
}

function getElementByXPath(xpath: string): Element | null {
    try {
        const result = document.evaluate(
            xpath,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
        )
        return result.singleNodeValue as Element | null
    } catch {
        return null
    }
}
