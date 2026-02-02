'use client'

import { useRef } from 'react'
import { cn } from '@heroui/theme'
import { useSelection } from '../define/utils'
import { useSelectionPosition } from '../utils/hooks'
import { Button, PressEvent } from '@heroui/react'
import { addMarkedItemAtom } from '../paper/atoms'
import { useSetAtom } from 'jotai'
import { BookmarkSimpleIcon } from '@phosphor-icons/react'
import { toast } from 'sonner'

export function MarkForLater() {
    const ref = useRef(globalThis.document)
    const selectionContext = useSelection(ref)
    const { left, width, selection } = selectionContext
    const { buttonTop, rect } = useSelectionPosition(selection)
    const addMarkedItem = useSetAtom(addMarkedItemAtom)

    const handleMark = (e: PressEvent) => {
        if (!selection) return

        const text = selection.toString()
        if (!text) return

        // Get XPath for the selection
        const xpath = getXPathForSelection(selection)
        if (!xpath) {
            toast.error('无法标记此内容')
            return
        }

        addMarkedItem({ text, xpath })
        toast.success('已标记')
    }

    return (
        <>
            {selection && selection.anchorNode?.textContent && selection.toString() && left && width && rect && (
                <Button
                    style={{
                        left: left + width / 2,
                        top: buttonTop
                    }}
                    className={cn(
                        'absolute -translate-x-1/2 z-50 border border-primary bg-background text-primary flex h-10 shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full',
                    )}
                    color='primary'
                    startContent={<BookmarkSimpleIcon weight='duotone' />}
                    variant='solid'
                    onPress={handleMark}
                >
                    Mark for later
                </Button>
            )}
        </>
    )
}

function getXPathForSelection(selection: Selection): string | null {
    if (!selection || selection.rangeCount === 0) {
        return null
    }

    const range = selection.getRangeAt(0)
    const { startContainer } = range

    // Find the closest element ancestor
    let node: Node | null = startContainer
    while (node && node.nodeType !== Node.ELEMENT_NODE) {
        node = node.parentNode
    }

    if (!node) {
        return null
    }

    return getXPath(node as Element)
}

function getXPath(element: Element): string | null {
    if (element.id) {
        return `//*[@id="${element.id}"]`
    }

    const parts: string[] = []
    let current: Element | null = element

    while (current && current.nodeType === Node.ELEMENT_NODE) {
        let index = 1
        let sibling = current.previousSibling

        while (sibling) {
            if (sibling.nodeType === Node.ELEMENT_NODE && (sibling as Element).tagName === current.tagName) {
                index++
            }
            sibling = sibling.previousSibling
        }

        const tagName = current.tagName.toLowerCase()
        const pathIndex = index > 1 ? `[${index}]` : ''
        parts.unshift(`${tagName}${pathIndex}`)

        current = current.parentElement
    }

    return parts.length ? '/' + parts.join('/') : null
}
