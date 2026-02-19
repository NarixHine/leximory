'use client'

import { Drawer } from 'vaul'
import Comment from '@/components/comment'
import { useRef } from 'react'
import { cn } from '@/lib/utils'
import { PiMagnifyingGlass } from 'react-icons/pi'
import { getLanguageStrategy } from '@/lib/languages/strategies'
import { useAtomValue } from 'jotai'
import { langAtom } from '@/app/library/[lib]/atoms'
import { EmptyObject } from 'react-hook-form'
import { useOnClickOutside } from 'usehooks-ts'
import { getBracketedSelection, useSelection } from '@repo/ui/define'

export default function Define(props: { left: number | null, width: number | null, bottom: number | null, selection: Selection | null, container: HTMLElement | null, reset: () => void } | EmptyObject) {
    const ref = useRef(globalThis.document)
    const selectionContext = useSelection(ref)
    const { left, width, selection } = props && 'left' in props ? props : selectionContext
    const container = props && 'container' in props ? props.container : undefined
    const reset = props && 'reset' in props ? props.reset : () => { }
    const buttonRef = useRef<HTMLButtonElement>(null!)
    const lang = useAtomValue(langAtom)

    const isEbookMode = !!container
    const { defineClassName, defineLabel } = getLanguageStrategy(lang)

    // 1. Get the bounding rectangle of the selection
    const rect = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).getBoundingClientRect() : null

    // 2. Calculate positioning
    let buttonTop = 0
    if (rect) {
        const centerY = rect.top + rect.height / 2
        const isUpperHalf = centerY < window.innerHeight / 2
        const scrollOffset = isEbookMode ? 50 : window.scrollY

        if (isUpperHalf) {
            // Position ABOVE the selection
            // rect.top is the top of the text, subtract ~50px for button height + margin
            buttonTop = scrollOffset + rect.top - 50
        } else {
            // Position BELOW the selection
            // rect.bottom is the bottom of the text, add ~10px margin
            buttonTop = scrollOffset + rect.bottom + 10
        }
    }

    useOnClickOutside(buttonRef, () => {
        reset()
    })

    return (
        <Drawer.Root repositionInputs={false} direction='top' container={container}>
            {selection && selection.anchorNode?.textContent && selection.toString() && left && width && rect && (
                <Drawer.Trigger
                    ref={buttonRef}
                    style={{
                        left: left + width / 2,
                        top: buttonTop // Applied the conditional top here
                    }}
                    className={cn(
                        'absolute -translate-x-1/2 z-50 flex h-10 shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full bg-white border border-default-100 px-4 text-sm font-medium shadow-sm transition-all hover:bg-[#FAFAFA] dark:bg-[#161615] dark:hover:bg-[#1A1A19] dark:text-white',
                        isEbookMode && 'opacity-90',
                        defineClassName
                    )}
                >
                    <PiMagnifyingGlass />
                    {defineLabel}
                </Drawer.Trigger>
            )}
            <Drawer.Portal>
                <Drawer.Overlay className={cn(
                    'fixed inset-0 z-60',
                    'bg-linear-to-b to-transparent from-default-900/40 dark:from-stone-950/60',
                )} />
                <Drawer.Content className='h-fit px-2 fixed top-3 left-0 right-0 outline-none z-70 flex flex-col justify-center items-center mx-auto max-w-lg'>
                    <Drawer.Title className='sr-only'>词汇注解</Drawer.Title>
                    <Comment asCard prompt={selection && selection.anchorNode?.textContent && selection.toString() ? getBracketedSelection(selection) : ''} params='[]'></Comment>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    )
}