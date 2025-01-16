export { }

declare global {
    interface CustomJwtSessionClaims {
        plan?: 'beginner' | 'interlocutor' | 'communicator'
    }
}

declare module '*.mdx' {
    let MDXComponent: (props: any) => JSX.Element
    export default MDXComponent
}
