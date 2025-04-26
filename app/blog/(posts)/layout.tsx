import Main from '@/components/ui/main'
import { postFontFamily } from '@/lib/fonts'
import { Metadata } from 'next'
import { ReactNode } from 'react'
import Link from 'next/link'
import { Button } from '@heroui/button'
import { PiArrowLeft } from 'react-icons/pi'

export const metadata: Metadata = {
    title: {
        default: 'The Leximory Blog',
        template: '%s | The Leximory Blog',
    },
}

export default function PostLayout({ children }: { children: ReactNode }) {
    return (
        <Main style={{
            fontFamily: postFontFamily,
        }} className={'relative pt-4 prose dark:prose-invert prose-a:underline-offset-4 prose-a:decoration-1 max-w-2xl prose-blockquote:not-italic prose-blockquote:border-primary-800 prose-blockquote:border-l-1.5'}>
            <div className='sticky top-4 z-50 pb-4'>
                <Button
                    as={Link}
                    href='/blog'
                    variant='light'
                    className='gap-2'
                    startContent={<PiArrowLeft className='w-4 h-4' />}
                >
                    Back to Blog
                </Button>
            </div>
            <article className='mt-8'>
                {children}
            </article>
        </Main>
    )
}
