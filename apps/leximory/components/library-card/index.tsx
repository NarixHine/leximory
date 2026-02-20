import { Card, CardBody } from '@heroui/card'
import { Lang } from '@repo/env/config'
import { getLanguageStrategy } from '@/lib/languages'
import Link from 'next/link'
import { ReactNode } from 'react'
import UserAvatar from '@repo/ui/avatar'

/** Props for the unified library card layout. */
export interface LibraryCardBaseProps {
    id: string
    name: string
    lang: string
    owner: string
    footer?: ReactNode
}

/** Shared layout for library cards across Libraries, Marketplace & Profile screens. */
export default function LibraryCardBase({ id, name, lang, owner, footer }: LibraryCardBaseProps) {
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
                    {/* Avatar + username */}
                    <div className='mb-3'>
                        <UserAvatar uid={owner} showInfo />
                    </div>
                    {/* Language */}
                    <span className='mb-2 inline-block text-sm text-default-400'>
                        {getLanguageStrategy(lang as Lang).name}
                    </span>
                    {/* Title */}
                    <h2 className='font-formal text-3xl leading-snug tracking-tight text-foreground text-balance'>
                        {name}
                    </h2>
                </CardBody>
            </Card>

            {/* Context-specific footer */}
            {footer && (
                <div className='flex items-center justify-between px-2 pt-2'>
                    {footer}
                </div>
            )}
        </div>
    )
}
