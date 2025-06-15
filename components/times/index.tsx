import Panel from './panel'
import { getRecentTimesData } from '@/server/db/times'
import Provider from './providers'

export default async function TheTimes() {
    const recentData = await getRecentTimesData()
   
    return <Provider><Panel recentData={recentData} /></Provider>
}
