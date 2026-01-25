'use client'

import { Tab, Tabs } from '@heroui/tabs'
import type { ReactNode } from 'react'
import { ScopeProvider } from 'jotai-scope'
import { viewModeAtom } from '@repo/ui/paper/atoms'
import { SpeedometerIcon } from '@phosphor-icons/react/ssr'

type QuizTabsUIProps = {
    Paper: ReactNode,
}

export function QuizTabsUI({ Paper }: QuizTabsUIProps) {
    return (
        <Tabs defaultSelectedKey={'paper'}>
            <Tab key='paper' title={<div className='flex items-center space-x-2'>
                <SpeedometerIcon weight='bold' />
                <span><span>解谜</span><span className='text-xs'></span></span>
            </div>}>
                {Paper}
            </Tab>
        </Tabs>
    )
}

export function QuizTabs({ Paper }: QuizTabsUIProps) {
    return (
        <ScopeProvider atoms={[viewModeAtom]}>
            <QuizTabsUI Paper={Paper} />
        </ScopeProvider>
    )
}
