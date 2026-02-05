'use client'

import { Tab, Tabs } from '@heroui/tabs'
import type { ReactNode } from 'react'
import { ScopeProvider } from 'jotai-scope'
import { viewModeAtom } from '@repo/ui/paper/atoms'
import { MagicWandIcon, SpeedometerIcon, TrophyIcon, PencilLineIcon } from '@phosphor-icons/react/ssr'

type QuizTabsUIProps = {
    Paper?: ReactNode,
    Revise?: ReactNode
    leaderboard?: ReactNode
    dictation?: ReactNode
}

export function QuizTabsUI({ Paper, Revise, leaderboard, dictation }: QuizTabsUIProps) {
    return (
        <Tabs defaultSelectedKey={'paper'} classNames={{
            tabList: 'print:hidden',
            panel: 'print:-mt-5'
        }}>
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
            {dictation && <Tab key='dictation' title={<div className='flex items-center space-x-2'>
                <PencilLineIcon weight='bold' />
                <span>默写纸</span>
            </div>}>
                {dictation}
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
