import type { MDXComponents } from 'mdx/types'
import MdImg from './components/mdimg'

export function useMDXComponents(components: MDXComponents): MDXComponents {
    return {
        img: ({ src, alt, title }) => <MdImg src={src!} alt={alt} title={title}></MdImg>,
        ...components,
    }
}
