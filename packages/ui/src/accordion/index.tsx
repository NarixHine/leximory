'use client'

import { Accordion as HeroAccordion, AccordionItem, AccordionProps, AccordionItemProps } from '@heroui/accordion'
import type { Key } from 'react'

export function Accordion({ itemProps, children, itemKey, ...props }: AccordionProps & {
    itemProps?: AccordionItemProps,
    itemKey?: Key,
    itemChildren?: React.ReactNode
}) {
    return (
        <HeroAccordion {...props}>
            <AccordionItem key={itemKey} {...itemProps}>
                {children}
            </AccordionItem>
        </HeroAccordion>
    )
}
