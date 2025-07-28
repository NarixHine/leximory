'use client'

import { Tabs, Tab } from '@heroui/react'
import { ReactNode } from 'react'

export function MemoryTabs({ personalFeed, federatedFeed }: { personalFeed: ReactNode, federatedFeed: ReactNode }) {
    return (
        <Tabs isVertical>
            <Tab key='personal' title='个人'>
                {personalFeed}
            </Tab>
            <Tab key='federated' title='公开'>
                {federatedFeed}
            </Tab>
        </Tabs>
    )
}
