'use client'

import { LineChart } from '@/components/chart'
import { formarChartData } from '.'

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
        data={formarChartData(new Map())}
        index='date'
        categories={['Count']}
        colors={['emerald']}
        valueFormatter={(value: number) => `${value} 词`}
        showLegend
        showGridLines
        showYAxis
        showXAxis
        startEndOnly
    />
} 
