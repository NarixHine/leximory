'use client'

import { Tabs, Tab } from '@heroui/react'
import { ReactNode } from 'react'
import { PiGlobeHemisphereEast, PiUser } from 'react-icons/pi'

export function MemoryTabs({ personalFeed, federatedFeed }: { personalFeed: ReactNode, federatedFeed: ReactNode }) {
    return (
        <Tabs isVertical classNames={{
            tabWrapper: 'w-full',
            panel: 'w-full',
        }}>
            <Tab key='personal' title={<PiUser />}>
                {personalFeed}
            </Tab>
            <Tab key='federated' title={<PiGlobeHemisphereEast />}>
                {federatedFeed}
            </Tab>
        </Tabs>
    )
}
