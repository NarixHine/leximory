import { getUserOrThrow } from '@/server/auth/user'
import { ADMIN_UID } from '@/lib/config'
import { ReactNode } from 'react'
import Main from '@/components/ui/main'
import { cn } from '@/lib/utils'
import { ENGLISH } from '@/lib/fonts'

export default async function AdminLayout({ children }: { children: ReactNode }) {
    const { userId, username } = await getUserOrThrow()

    if (userId !== ADMIN_UID) {
        throw new Error('Unauthorized access to admin area')
    }

    return (
        <Main className={cn('max-w-screen-lg flex flex-col gap-10')}>
            <header>
                <h2 className={cn('text-4xl font-medium text-center', ENGLISH.className)}>Welcome back, {username}</h2>
            </header>
            {children}
        </Main>
    )
}