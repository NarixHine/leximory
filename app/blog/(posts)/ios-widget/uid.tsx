import { auth } from '@clerk/nextjs/server'
import { Snippet } from '@heroui/snippet'

export default async function UID() {
    const { userId } = await auth()
    return <Snippet classNames={{
        pre: 'my-0',
    }}>{userId ?? '未登录'}</Snippet>
}

