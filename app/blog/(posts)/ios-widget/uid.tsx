import { Snippet } from '@heroui/snippet'
import { getUserOrThrow } from '@/server/auth/user'

export default async function UID() {
    const { userId } = await getUserOrThrow()
    return <Snippet classNames={{
        pre: 'my-0',
        base: 'not-prose'
    }}>{userId ?? '未登录'}</Snippet>
}
