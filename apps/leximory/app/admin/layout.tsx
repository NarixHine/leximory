import { ReactNode, Suspense } from 'react'
import { ADMIN_UID } from '@repo/env/config'
import { getUserOrThrow } from '@repo/user'
import { Avatar } from '@heroui/avatar'
import Main from '@/components/ui/main'
import LinkButton from '@repo/ui/link-button'
import { PiArrowLeftDuotone, PiShieldStarDuotone } from 'react-icons/pi'
import AdminNav from './components/admin-nav'
import Forbidden from './components/forbidden'
import { cn } from '@/lib/utils'

export const metadata = {
    title: 'Admin',
}

export default function AdminLayout({ children }: { children: ReactNode }) {
    return (
        <Suspense fallback={<AdminShellSkeleton />}>
            <AdminShell>{children}</AdminShell>
        </Suspense>
    )
}

async function AdminShell({ children }: { children: ReactNode }) {
    const { userId, username, email, image } = await getUserOrThrow()

    if (userId !== ADMIN_UID) {
        return <Forbidden />
    }

    return (
        <Main className={cn('max-w-(--breakpoint-lg) flex flex-col gap-7')}>
            <header className='flex items-center justify-between gap-4'>
                <div className='flex items-center gap-3 min-w-0'>
                    <div className='grid place-items-center size-11 shrink-0 rounded-2xl bg-linear-to-br from-default-50 to-default-200/70 dark:from-default-100 dark:to-default-200/40'>
                        <PiShieldStarDuotone className='size-5 text-default-600' />
                    </div>
                    <div className='min-w-0'>
                        <p className='font-mono text-[10px] uppercase tracking-[0.22em] text-default-500'>
                            Leximory
                        </p>
                        <h1 className='font-formal text-xl leading-tight tracking-tight'>
                            Admin Console
                        </h1>
                    </div>
                </div>

                <div className='flex items-center gap-3'>
                    <div className='hidden sm:flex flex-col items-end min-w-0'>
                        <span className='text-sm truncate max-w-48'>
                            {username ?? 'Administrator'}
                        </span>
                        <span className='font-mono text-[11px] text-default-500 truncate max-w-48'>
                            {email}
                        </span>
                    </div>
                    <Avatar
                        src={image}
                        name={username ?? 'A'}
                        size='sm'
                        isBordered
                        color='default'
                        className='shrink-0'
                    />
                    <LinkButton
                        href='/library'
                        size='sm'
                        variant='flat'
                        color='default'
                        radius='full'
                        className='hidden md:inline-flex'
                        startContent={<PiArrowLeftDuotone className='size-4' />}
                    >
                        Library
                    </LinkButton>
                </div>
            </header>

            <AdminNav />

            {children}
        </Main>
    )
}

function AdminShellSkeleton() {
    return (
        <Main className={cn('max-w-(--breakpoint-lg) flex flex-col gap-7')}>
            <div className='flex items-center justify-between gap-4'>
                <div className='flex items-center gap-3'>
                    <div className='size-11 shrink-0 animate-pulse rounded-2xl bg-default-100' />
                    <div className='flex flex-col gap-1.5'>
                        <div className='h-2 w-14 animate-pulse rounded-full bg-default-100' />
                        <div className='h-5 w-32 animate-pulse rounded-full bg-default-100' />
                    </div>
                </div>
                <div className='h-8 w-24 animate-pulse rounded-full bg-default-100' />
            </div>
            <div className='h-11 w-52 animate-pulse rounded-full bg-default-100' />
        </Main>
    )
}
