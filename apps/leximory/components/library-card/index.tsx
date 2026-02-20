import { Card, CardBody } from '@heroui/card'
import { Lang } from '@repo/env/config'
import { getLanguageStrategy } from '@/lib/languages'
import Link from 'next/link'
import { ReactNode } from 'react'

/** Props for the unified library card layout. */
export interface LibraryCardBaseProps {
    /** Library ID for routing. */
    id: string
    /** Display name of the library. */
    name: string
    /** Language code (e.g. 'en', 'ja'). */
    lang: string
    /** Owner user ID for avatar display. */
    owner: string
    /** Context-specific footer actions (e.g. recent access, settings, purchase). */
    footer?: ReactNode
}

/** Shared layout for library cards across Libraries, Marketplace & Profile screens. */
export default function LibraryCardBase({ id, name, lang, footer }: LibraryCardBaseProps) {
    return (
        <div className='block break-inside-avoid rounded-3xl bg-default-50 p-3.5'>
            <Card
                as={Link}
                isPressable
                shadow='none'
                href={`/library/${id}`}
                className='p-0 bg-transparent'
            >
                <CardBody className='p-0 bg-default-100 rounded-2xl px-6 pb-7 pt-5'>
                    <span className='mb-2 inline-block font-semibold text-default-400'>
                        {getLanguageStrategy(lang as Lang).name}
                    </span>
                    <h2 className='font-formal text-3xl leading-snug tracking-tight text-foreground text-balance'>
                        {name}
                    </h2>
                </CardBody>
            </Card>

            {footer && (
                <div className='flex items-center justify-between px-2 pt-2'>
                    {footer}
                </div>
            )}
        </div>
    )
}
