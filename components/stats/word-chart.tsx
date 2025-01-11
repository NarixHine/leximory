'use client'

import { LineChart } from '@/components/ui/chart'
import { formatChartData } from '.'

type WordData = {
    date: string
    Count: number
}

export default function WordChart({ data }: { data: WordData[] }) {
    return <LineChart
        data={data}
        index='date'
        categories={['Count']}
        colors={['emerald']}
        valueFormatter={(value: number) => `${value} 词`}
        showLegend
        showGridLines
        showYAxis
        showXAxis
        startEndOnly
        allowDecimals={false}
    />
}

export function WordChartSkeleton() {
    return <LineChart
        className='opacity-30 animate-pulse'
        data={formatChartData(new Map())}
        index='date'
        categories={['Count']}
        colors={['gray']}
        valueFormatter={(value: number) => `${value} 词`}
        showLegend
        showGridLines
        showYAxis
        showXAxis
        startEndOnly
    />
} 
