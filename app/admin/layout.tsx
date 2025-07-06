import { getUserOrThrow } from '@/server/auth/user'
import { ADMIN_UID } from '@/lib/config'
import { ReactNode } from 'react'
import Main from '@/components/ui/main'
import AdminBreadcrumbs from './components/breadcrumbs'
import AdminQueryProvider from './components/query-provider'
import { cn } from '@/lib/utils'

export const metadata = {
    title: 'Admin Area',
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
    const { userId } = await getUserOrThrow()

    if (userId !== ADMIN_UID) {
        throw new Error('Unauthorized access to admin area')
    }

    return (
        <Main className={cn('max-w-screen-lg flex flex-col gap-10')}>
            <AdminQueryProvider>
                <AdminBreadcrumbs />
                {children}
            </AdminQueryProvider>
        </Main>
    )
}