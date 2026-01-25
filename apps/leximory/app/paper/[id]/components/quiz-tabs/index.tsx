'use client'

import { Tab, Tabs } from '@heroui/tabs'
import { useSetAtom } from 'jotai'
import type { Key, ReactNode } from 'react'
import { ScopeProvider } from 'jotai-scope'
import { viewModeAtom } from '@repo/ui/paper/atoms'
import { PiGridFourBold, PiSpeedometerBold } from 'react-icons/pi'


type QuizTabsUIProps = {
    Paper: ReactNode,
    AnswerSheet: ReactNode
}

export function QuizTabsUI({ Paper, AnswerSheet }: QuizTabsUIProps) {
    const setPureEditing = useSetAtom(viewModeAtom)

    const onTabChange = (key: Key) => {
        setPureEditing(key === 'answer-sheet' ? 'pure' : 'normal')
    }

    return (
        <Tabs defaultSelectedKey={'paper'} onSelectionChange={onTabChange}>
            <Tab key='paper' title={<div className='flex items-center space-x-2'>
                <PiSpeedometerBold />
                <span><span>试卷</span><span className='text-xs'>（在线答题模式）</span></span>
            </div>}>
                {Paper}
            </Tab>
            <Tab key='answer-sheet' title={<div className='flex items-center space-x-2'>
                <PiGridFourBold />
                <span><span>答题卡</span><span className='text-xs'>（纯净上传模式）</span></span>
            </div>}>
                {AnswerSheet}
            </Tab>
        </Tabs>
    )
}

export function QuizTabs({ Paper, AnswerSheet }: QuizTabsUIProps) {
    return (
        <ScopeProvider atoms={[viewModeAtom]}>
            <QuizTabsUI Paper={Paper} AnswerSheet={AnswerSheet} />
        </ScopeProvider>
    )
}
