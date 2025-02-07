import { formatChartData } from '.'
import { LineChart } from '../ui/line-chart'

type WordData = {
    date: string
    '记忆单词数': number
}

export default function WordChart({ data }: { data: WordData[] }) {
    return <LineChart
        data={data}
        index='date'
        categories={['记忆单词数']}
        showLegend
        startEndOnly
        allowDecimals={false}
    />
}

export function WordChartSkeleton() {
    return <LineChart
        className='opacity-30 animate-pulse'
        data={formatChartData(new Map(), 30)}
        index='date'
        categories={['记忆单词数']}
        showLegend
        colors={['default']}


        startEndOnly
    />
} 
