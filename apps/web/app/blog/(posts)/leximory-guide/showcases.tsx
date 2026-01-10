import { UserPublicFeed } from '@/app/memories/components/user-public-feed'
import { ADMIN_UID } from '@/lib/config'
import { ShowcaseWrapper } from '../ai-agent/showcases'
import { StreakDisplay } from '@/components/streak/streak-display'

export function AdminMemoryFeed() {
    return (<ShowcaseWrapper title='我的 Memories'>
        <UserPublicFeed userId={ADMIN_UID} />
    </ShowcaseWrapper>)
}

export function Streak() {
    return <StreakDisplay streakData={{
        total: 100,
        highest: 324,
        history: [
            { date: '2025-07-01', active: true },
            { date: '2025-07-02', active: true },
            { date: '2025-07-03', active: true },
            { date: '2025-07-04', active: true },
            { date: '2025-07-05', active: true },
            { date: '2025-07-06', active: true },
            { date: '2025-07-07', active: true },
            { date: '2025-07-08', active: true },
        ]
    }} />
}
