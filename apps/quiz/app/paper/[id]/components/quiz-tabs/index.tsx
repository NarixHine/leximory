'use client'

import { Tab, Tabs } from '@heroui/tabs'
import type { ReactNode } from 'react'
import { ScopeProvider } from 'jotai-scope'
import { viewModeAtom } from '@repo/ui/paper/atoms'
import { MagicWandIcon, SpeedometerIcon, TrophyIcon } from '@phosphor-icons/react/ssr'

type QuizTabsUIProps = {
    Paper?: ReactNode,
    Revise?: ReactNode
    leaderboard?: ReactNode
}

export function QuizTabsUI({ Paper, Revise, leaderboard }: QuizTabsUIProps) {
    return (
        <Tabs defaultSelectedKey={'paper'}>
            {Paper && <Tab key='paper' title={<div className='flex items-center space-x-2'>
                <SpeedometerIcon weight='bold' />
                <span>解谜</span>
            </div>}>
                {Paper}
            </Tab>}
             {Revise && <Tab key='revise' title={<div className='flex items-center space-x-2'>
                 <MagicWandIcon weight='bold' />
                <span>解惑</span>
            </div>}>
                {Revise}
            </Tab>}
            {leaderboard && <Tab key='leaderboard' title={<div className='flex items-center space-x-2'>
                <TrophyIcon weight='bold' />
                <span>排行榜</span>
            </div>}>
                {leaderboard}
            </Tab>}
        </Tabs>
    )
}

export function QuizTabs(props: QuizTabsUIProps) {
    return (
        <ScopeProvider atoms={[viewModeAtom]}>
            <QuizTabsUI {...props} />
        </ScopeProvider>
    )
}
