import Main from '@/components/ui/main'
import { Metadata } from 'next'
import { ReactNode } from 'react'
import { PiArrowLeft } from 'react-icons/pi'
import LinkButton from '@repo/ui/link-button'

export const metadata: Metadata = {
    title: {
        default: 'The Leximory Blog',
        template: '%s | The Leximory Blog',
    },
}

export default function PostLayout({ children }: { children: ReactNode }) {
    return (
        <Main className={'relative pt-6 prose prose-h1:text-4xl dark:prose-invert prose-lg prose-a:underline-offset-4 prose-a:decoration-1 max-w-2xl prose-blockquote:not-italic prose-blockquote:border-primary-800 prose-blockquote:border-l-1.5 font-formal'}>
            <div className='fixed top-2 left-2 z-50'>
                <LinkButton
                    href='/blog'
                    variant='light'
                    size='sm'
                    className='gap-2 backdrop-blur bg-background/50 not-prose'
                    startContent={<PiArrowLeft className='w-4 h-4' />}
                >
                    Back to Blog
                </LinkButton>
            </div>
            <article className='mt-8'>
                {children}
            </article>
        </Main>
    )
}
