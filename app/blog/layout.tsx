import Main from '@/components/main'
import { postFontFamily } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

export default function PostLayout({ children }: { children: ReactNode }) {
    return <Main style={{
        fontFamily: postFontFamily,
    }} className={cn('prose dark:prose-invert prose-a:underline-offset-4 prose-a:decoration-1 max-w-2xl')}>
        <article>
            {children}
        </article>
    </Main>
}
