import { UserPublicFeed } from '@/app/memories/components/user-public-feed'
import { ADMIN_UID } from '@/lib/config'
import { ShowcaseWrapper } from '../ai-agent/showcases'
import { StreakDisplay } from '@/app/settings/components/streak-display'

export function AdminMemoryFeed() {
    return (<ShowcaseWrapper title='我的 Memories'>
        <UserPublicFeed userId={ADMIN_UID} />
    </ShowcaseWrapper>)
}

export function Streak() {
    return <StreakDisplay streakData={{
        total: 10,
        history: [
            { date: '2025-7-01', active: true },
            { date: '2025-7-02', active: true },
            { date: '2025-7-03', active: true },
            { date: '2025-7-04', active: true },
            { date: '2025-7-05', active: true },
            { date: '2025-7-06', active: true },
            { date: '2025-7-07', active: true },
            { date: '2025-7-08', active: true },
        ]
    }} />
}
