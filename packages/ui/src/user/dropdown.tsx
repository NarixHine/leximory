'use client'

import { Dropdown, DropdownItem, DropdownMenu, DropdownSection, DropdownTrigger } from '@heroui/dropdown'
import { prefixUrl, ACTION_QUOTA_COST } from '@repo/env/config'
import { createClient } from '@repo/supabase/client'
import { useRouter } from 'next/navigation'
import React, { Suspense, Usable, use } from 'react'
import { PiSignIn, PiSignOut } from 'react-icons/pi'
import { Progress } from '@heroui/progress'
import { Spinner } from '@heroui/spinner'
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from '@heroui/modal'
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from '@heroui/table'
import { Button } from '@heroui/button'
import { getCommentaryQuota } from '@repo/user/quota'
import moment from 'moment'
import 'moment/locale/zh-cn'

type QuotaPromise = Usable<Awaited<ReturnType<typeof getCommentaryQuota>>>

function QuotaProgress({ quotaPromise }: { quotaPromise: QuotaPromise }) {
    const { max, quota } = use(quotaPromise)
    return (
        <Progress
            size='sm'
            color='secondary'
            maxValue={max}
            showValueLabel
            label={<div>词点 <span className='font-mono'>{quota}/{max}</span></div>}
            value={quota}
        />
    )
}

function QuotaProgressDetail({ quotaPromise }: { quotaPromise: QuotaPromise }) {
    const { max, quota, ttl } = use(quotaPromise)
    return (
        <Progress
            size='sm'
            color='secondary'
            maxValue={max}
            showValueLabel
            label={<div><span className='font-mono'>{max}</span> 词点已使用 <span className='font-mono'>{quota}</span>（离重置还有：{moment.duration(ttl, 'seconds').locale('zh-cn').humanize()}）</div>}
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

export function AvatarDropdown({ trigger, isLoggedIn, quotaPromise, quotaModalChildren }: { trigger: React.ReactNode, isLoggedIn: boolean, quotaPromise: QuotaPromise, quotaModalChildren?: React.ReactNode }) {
    const router = useRouter()
    const { isOpen, onOpen, onOpenChange } = useDisclosure()
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
        <>
            <Dropdown>
                <DropdownTrigger>
                    {trigger}
                </DropdownTrigger>
                <DropdownMenu aria-label='User Menu'>
                    {isLoggedIn ? (
                        <DropdownSection showDivider title='本月额度'>
                            <DropdownItem key='quota' onPress={onOpen}>
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
            <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className='flex flex-col gap-1'>词点消耗详情</ModalHeader>
                            <ModalBody>
                                <Suspense fallback={<QuotaFallback />}>
                                    <QuotaProgressDetail quotaPromise={quotaPromise} />
                                </Suspense>
                                {quotaModalChildren}
                            </ModalBody>
                            <ModalFooter>
                                <Button color='primary' onPress={onClose}>
                                    关闭
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </>
    )
}

