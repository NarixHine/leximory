'use client'

import { Accordion as HeroAccordion, AccordionItem, AccordionProps, AccordionItemProps } from '@heroui/accordion'

export function Accordion({ itemProps, children, ...props }: AccordionProps & {
    itemProps?: AccordionItemProps,
    itemChildren?: React.ReactNode
}) {
    return (
        <HeroAccordion {...props}>
            <AccordionItem {...itemProps}>
                {children}
            </AccordionItem>
        </HeroAccordion>
    )
}
