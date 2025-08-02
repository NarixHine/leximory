import type { MDXComponents } from 'mdx/types'
import MdImg from './components/ui/mdimg'
import { cn } from '@/lib/utils'

export function useMDXComponents(components: MDXComponents): MDXComponents {
    return {
        p: ({ children, className, ...props }) => <div className={cn(className, 'my-2 font-formal')} {...props}>{children}</div>,
        img: ({ src, alt, title }) => <MdImg src={src!} alt={alt} title={title} disableSpecialStyles></MdImg>,
        ...components,
    }
}
