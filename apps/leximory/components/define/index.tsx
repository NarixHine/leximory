'use client'

import { Drawer } from 'vaul'
import Comment from '@/components/comment'
import { ReactNode, useRef } from 'react'
import { cn } from '@/lib/utils'
import { PiMagnifyingGlass } from 'react-icons/pi'
import { getLanguageStrategy } from '@/lib/languages/strategies'
import { useAtomValue } from 'jotai'
import { langAtom } from '@/app/library/[lib]/atoms'
import { EmptyObject } from 'react-hook-form'
import { useOnClickOutside } from 'usehooks-ts'
import { getBracketedSelection, useSelection } from '@repo/ui/define'
import { Button } from '@heroui/button'

export default function Define(
    props:
        | {
              left: number | null
              width: number | null
              top: number | null
               bottom: number | null
               selection: Selection | null
               selectedText?: string
               container: HTMLElement | null
              reset: () => void
              /** Trailing actions rendered beside the Define trigger (e.g. bookmark). */
              actions?: ReactNode
          }
        | EmptyObject,
) {
    const ref = useRef(globalThis.document)
    const selectionContext = useSelection(ref)
    const { left, width, selection } = props && 'left' in props ? props : selectionContext
    const selectedText = props && 'selectedText' in props ? props.selectedText : undefined
    const container = props && 'container' in props ? props.container : undefined
    const reset = props && 'reset' in props ? props.reset : () => {}
    const positionTop = props && 'top' in props ? props.top : null
    const positionBottom = props && 'bottom' in props ? props.bottom : null
    const actions = props && 'actions' in props ? props.actions : undefined
    const wrapperRef = useRef<HTMLDivElement>(null!)
    const lang = useAtomValue(langAtom)

    const isEbookMode = !!container
    const { defineClassName, defineLabel } = getLanguageStrategy(lang)

    // 1. Get the bounding rectangle of the selection
    const rect =
        selection && selection.rangeCount > 0
            ? selection.getRangeAt(0).getBoundingClientRect()
            : selectedText
              ? ({ top: positionTop ?? 0, bottom: positionBottom ?? 0 } as DOMRect)
              : null

    // 2. Calculate positioning
    let buttonTop = 0
    if (rect) {
        if (isEbookMode && positionTop !== null && positionBottom !== null && container) {
            // EPUB selections are measured in the iframe's viewport. The parent
            // passes coordinates relative to the browser viewport.
            const centerY = (positionTop + positionBottom) / 2
            const isUpperHalf = centerY < window.innerHeight / 2
            buttonTop = isUpperHalf ? positionTop - 50 : positionBottom + 10
        } else {
            const centerY = rect.top + rect.height / 2
            const isUpperHalf = centerY < window.innerHeight / 2
            const scrollOffset = window.scrollY

            if (isUpperHalf) {
                buttonTop = scrollOffset + rect.top - 50
            } else {
                buttonTop = scrollOffset + rect.bottom + 10
            }
        }
    }

    useOnClickOutside(wrapperRef, () => {
        reset()
    })

    return (
        <Drawer.Root repositionInputs={false} direction='top' container={container}>
            {((selection && selection.anchorNode?.textContent && selection.toString()) || selectedText) &&
                left !== null &&
                width !== null &&
                rect && (
                    <div
                        ref={wrapperRef}
                        style={{
                            left: left! + width! / 2,
                            top: buttonTop, // Applied the conditional top here
                        }}
                        className={cn(
                            'absolute z-50 flex -translate-x-1/2 items-center gap-2',
                            isEbookMode && 'fixed opacity-95',
                        )}
                    >
                        <Drawer.Trigger asChild>
                            <Button
                                color='primary'
                                variant='solid'
                                size='md'
                                radius='full'
                                startContent={<PiMagnifyingGlass />}
                                className={cn('h-10 font-semibold shadow-md', defineClassName)}
                            >
                                {defineLabel}
                            </Button>
                        </Drawer.Trigger>
                        {actions}
                    </div>
                )}
            <Drawer.Portal>
                <Drawer.Overlay
                    className={cn(
                        'fixed -inset-5 bottom-[20dvh] z-60',
                        'bg-linear-to-b to-transparent from-default-900/40 dark:from-stone-950/60',
                    )}
                />
                <Drawer.Content className='h-fit px-2 fixed top-3 left-0 right-0 outline-none z-70 flex flex-col justify-center items-center mx-auto max-w-lg'>
                    <Drawer.Title className='sr-only'>词汇注解</Drawer.Title>
                    <Comment
                        asCard
                        prompt={
                            selectedText ||
                            (selection && selection.anchorNode?.textContent && selection.toString()
                                ? getBracketedSelection(selection)
                                : '')
                        }
                        params='[]'
                    ></Comment>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    )
}
