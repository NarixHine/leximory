import Main from '@/components/main'
import { postFontFamily } from '@/lib/fonts'
import { ReactNode } from 'react'

export default function PostLayout({ children }: { children: ReactNode }) {
    return <Main style={{
        fontFamily: postFontFamily,
    }} className={'prose dark:prose-invert prose-a:underline-offset-4 prose-a:decoration-1 max-w-2xl pt-16 prose-blockquote:not-italic prose-blockquote:border-danger-300 prose-blockquote:border-l-1.5 prose-blockquote:text-danger-500'}>
        <article>
            {children}
        </article>
    </Main>
}
