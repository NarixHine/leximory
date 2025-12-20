import type { MDXComponents } from 'mdx/types'
import MdImg from './components/ui/mdimg'
import { cn } from '@/lib/utils'

export function useMDXComponents(components: MDXComponents): MDXComponents {
    return {
        p: ({ children, className, ...props }) => <div className={cn(className, 'my-2 font-formal')} {...props}>{children}</div>,
        img: ({ src, alt, title }) => <MdImg src={src!} alt={alt} title={title}></MdImg>,
        h1: ({ children, className, ...props }) => <h1 className={cn(className, 'font-fancy')} {...props}>{children}</h1>,
        ...components,
    }
}
