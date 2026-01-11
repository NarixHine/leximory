import { Snippet } from '@heroui/snippet'
import { getUserOrThrow } from '@repo/user'
import { Suspense } from 'react'

export default function UidSnippet() {
    return <Suspense fallback={
        <Snippet classNames={{
            pre: 'my-0',
            base: 'not-prose'
        }} />
    }>
        <UidSnippetContent />
    </Suspense>
}

async function UidSnippetContent() {
    const { userId } = await getUserOrThrow()
    return <Snippet classNames={{
        pre: 'my-0',
        base: 'not-prose'
    }}>{userId ?? '未登录'}</Snippet>
}
