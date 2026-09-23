import { Suspense } from 'react'
import { getAllUsers } from '../data-fetching'
import UserTable, { UserTableSkeleton } from '../components/user-table'

export const metadata = {
    title: 'Users',
}

export default function AdminUsersPage() {
    return (
        <Suspense fallback={<UsersPageShell><UserTableSkeleton /></UsersPageShell>}>
            <AdminUsersContent />
        </Suspense>
    )
}

async function AdminUsersContent() {
    const users = await getAllUsers()

    return (
        <UsersPageShell>
            <UserTable users={users} />
        </UsersPageShell>
    )
}

function UsersPageShell({ children }: { children: React.ReactNode }) {
    return (
        <div className='flex flex-col gap-6'>
            <section className='flex flex-col gap-1'>
                <h2 className='font-formal text-2xl tracking-tight'>Users</h2>
                <p className='text-sm text-default-600'>
                    Search, review, and manage every account. Changes apply immediately.
                </p>
            </section>
            {children}
        </div>
    )
}
