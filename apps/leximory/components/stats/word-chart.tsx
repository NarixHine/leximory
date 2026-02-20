import { AvailableChartColorsKeys } from '@/components/stats/chart-utils'
import { AreaChart } from '../ui/area-chart'

type WordData = {
    date: string
    '保存词汇': number
}

export default function WordChart({ data, color = 'default' }: { data: WordData[], color?: AvailableChartColorsKeys }) {
    return <AreaChart
        data={data}
        colors={[color]}
        index='date'
        categories={['保存词汇']}
        showLegend={false}
        startEndOnly
        showGridLines={false}
        allowDecimals={false}
    />
}

/** Skeleton placeholder matching the chart area dimensions */
export function WordChartSkeleton() {
    return <div className='h-64 w-full animate-pulse rounded-2xl bg-default-100' />
} 
