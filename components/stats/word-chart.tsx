import { formatChartData } from '.'
import { AreaChart } from '../ui/area-chart'

type WordData = {
    date: string
    '记忆单词数': number
}

export default function WordChart({ data }: { data: WordData[] }) {
    return <AreaChart
        data={data}
        index='date'
        categories={['记忆单词数']}
        showLegend
        startEndOnly
        allowDecimals={false}
    />
}

export function WordChartSkeleton() {
    return <AreaChart
        className='opacity-30 animate-pulse'
        data={formatChartData(new Map(), 30)}
        index='date'
        categories={['记忆单词数']}
        showLegend
        colors={['default']}
        startEndOnly
    />
} 
