export { Plan } from '@/server/auth/quota'

declare global {
    interface CustomJwtSessionClaims {
        plan?: Plan
    }
}

declare module '*.mdx' {
    let MDXComponent: (props: any) => JSX.Element
    export default MDXComponent
}
