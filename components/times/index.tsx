import Panel from './panel'
import { getRecentTimesData } from '@/server/db/times'
import Provider from './providers'
import { isAtRead } from '@/lib/subapp'
import { cn } from '@/lib/utils'

export default async function TheTimes() {
    const [recentData, isFullScreen] = await Promise.all([await getRecentTimesData(), await isAtRead()])

    return <main className={cn('h-dvh w-full', isFullScreen ? 'p-0' : 'p-4')}>
        <Provider isFullScreen={isFullScreen}>
            <Panel recentData={recentData} />
        </Provider>
    </main>
}
