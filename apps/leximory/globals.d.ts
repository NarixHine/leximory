export { Plan } from '@repo/user/quota'

declare global {
    interface CustomJwtSessionClaims {
        plan?: Plan
    }
}

declare module '*.mdx' {
    let MDXComponent: (props: any) => JSX.Element
    export default MDXComponent
}
