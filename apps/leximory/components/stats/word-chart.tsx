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

export function WordChartSkeleton() {
    return <AreaChart
        className='opacity-30 animate-pulse'
        data={new Array(30).fill(0).map((_, i) => ({
            date: `Day ${i + 1}`,
            '保存词汇': 0
        }))}
        index='date'
        categories={['保存词汇']}
        showLegend={false}
        startEndOnly
        showGridLines={false}
        allowDecimals={false}
    />
}
