'use client'

import { Dropdown, DropdownItem, DropdownMenu, DropdownSection, DropdownTrigger } from '@heroui/dropdown'
import { prefixUrl } from '@repo/env/config'
import { createClient } from '@repo/supabase/client'
import { useRouter } from 'next/navigation'
import { Suspense, Usable, use } from 'react'
import { PiSignIn, PiSignOut } from 'react-icons/pi'
import { Progress } from '@heroui/progress'
import { Spinner } from '@heroui/spinner'

type QuotaPromise = Usable<{ quota: number, max: number }>

function QuotaProgress({ quotaPromise }: { quotaPromise: QuotaPromise }) {
    const { max, quota } = use(quotaPromise)
    return (
        <Progress
            size='sm'
            color='secondary'
            maxValue={max}
            showValueLabel
            label={`词点 ${quota}/${max}`}
            value={quota}
        />
    )
}

function QuotaFallback() {
    return (
        <Progress
            size='sm'
            color='secondary'
            isIndeterminate
            label={<div className='flex gap-1 items-center'>词点 <Spinner size='sm' variant='dots' /></div>}
        />
    )
}

export function AvatarDropdown({ trigger, isLoggedIn, quotaPromise }: { trigger: React.ReactNode, isLoggedIn: boolean, quotaPromise: QuotaPromise }) {
    const router = useRouter()
    const handleLogin = () => {
        window.location.href = prefixUrl('/satellite?next=' + encodeURIComponent(window.location.href))
    }
    const handleLogout = () => {
        const supabase = createClient()
        supabase.auth.signOut().then(() => {
            router.refresh()
        })
    }
    return (
        <Dropdown>
            <DropdownTrigger>
                {trigger}
            </DropdownTrigger>
            <DropdownMenu aria-label='User Menu'>
                {isLoggedIn ? (
                    <DropdownSection showDivider title='本月额度'>
                        <DropdownItem key='dashboard' href={prefixUrl('/')}>
                            <Suspense fallback={<QuotaFallback />}>
                                <QuotaProgress quotaPromise={quotaPromise} />
                            </Suspense>
                        </DropdownItem>
                    </DropdownSection>
                ) : null}
                {
                    isLoggedIn
                        ? <DropdownItem key='logout' startContent={<PiSignOut />} onPress={handleLogout}>登出 Leximory 账户</DropdownItem>
                        : <DropdownItem key='login' startContent={<PiSignIn />} onPress={handleLogin}>通过 Leximory 登录</DropdownItem>
                }
            </DropdownMenu>
        </Dropdown>
    )
}
