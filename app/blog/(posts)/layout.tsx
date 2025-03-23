import Main from '@/components/ui/main'
import { postFontFamily } from '@/lib/fonts'
import { Metadata } from 'next'
import { ReactNode } from 'react'

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
        }} className={'relative prose dark:prose-invert prose-a:underline-offset-4 prose-a:decoration-1 max-w-2xl pt-16 prose-blockquote:not-italic prose-blockquote:border-primary-800 prose-blockquote:border-l-1.5'}>
            <article>
                {children}
            </article>
        </Main>
    )
}
