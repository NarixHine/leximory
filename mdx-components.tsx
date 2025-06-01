import type { MDXComponents } from 'mdx/types'
import MdImg from './components/ui/mdimg'
import { cn } from '@/lib/utils'
import { contentFontFamily } from './lib/fonts'

export function useMDXComponents(components: MDXComponents): MDXComponents {
    return {
        p: ({ children, className, ...props }) => <div style={{ fontFamily: contentFontFamily }} className={cn(className, 'my-2')} {...props}>{children}</div>,
        img: ({ src, alt, title }) => <MdImg src={src!} alt={alt} title={title}></MdImg>,
        ...components,
    }
}
