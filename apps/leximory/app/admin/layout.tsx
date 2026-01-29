import { getUserOrThrow } from '@repo/user'
import { ADMIN_UID } from '@repo/env/config'
import { ReactNode, Suspense } from 'react'
import Main from '@/components/ui/main'
import AdminBreadcrumbs from './components/breadcrumbs'
import { cn } from '@/lib/utils'

export const metadata = {
    title: 'Admin Area',
}

export default function AdminLayout({ children }: { children: ReactNode }) {
    return (
        <Suspense>
            <AdminLayoutContetn>
                {children}
            </AdminLayoutContetn>
        </Suspense>
    )
}

async function AdminLayoutContetn({ children }: { children: ReactNode }) {
    const { userId } = await getUserOrThrow()

    if (userId !== ADMIN_UID) {
        throw new Error('Unauthorized access to admin area')
    }

    return (
        <Main className={cn('max-w-(--breakpoint-lg) flex flex-col gap-10')}>
            <AdminBreadcrumbs />
            {children}
        </Main>
    )
}
