"use client"

import * as React from "react"
import {
    Area,
    AreaChart as RechartsAreaChart,
    CartesianGrid,
    XAxis,
    YAxis,
} from "recharts"

import {
    ChartConfig,
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/smooth-chart"
import { cn } from "@/lib/utils"
import { AvailableChartColorsKeys } from "@/components/stats/chart-utils"

const colorVarMap: Record<AvailableChartColorsKeys, string> = {
    warning: "hsl(var(--heroui-warning-500))",
    primary: "hsl(var(--heroui-primary-500))",
    secondary: "hsl(var(--heroui-secondary-500))",
    default: "hsl(var(--heroui-default-500))",
}

interface AreaChartProps {
    data: Record<string, string | number>[]
    index: string
    categories: string[]
    colors?: AvailableChartColorsKeys[]
    showLegend?: boolean
    showGridLines?: boolean
    startEndOnly?: boolean
    allowDecimals?: boolean
    className?: string
}

export function AreaChart({
    data,
    index,
    categories,
    colors = ["primary"],
    showLegend = false,
    showGridLines = true,
    startEndOnly = false,
    allowDecimals = true,
    className,
}: AreaChartProps) {
    const chartConfig = React.useMemo<ChartConfig>(() => {
        return Object.fromEntries(
            categories.map((cat, i) => [
                cat,
                {
                    label: cat,
                    color: colorVarMap[colors[i % colors.length]],
                },
            ])
        )
    }, [categories, colors])

    return (
        <ChartContainer config={chartConfig} className={cn("w-full h-28", className)}>
            <RechartsAreaChart data={data} margin={{ left: 0, right: 0 }}>
                <defs>
                    {categories.map((cat, i) => {
                        const colorKey = colors[i % colors.length]
                        return (
                            <linearGradient
                                key={cat}
                                id={`fill-${cat}`}
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                            >
                                <stop
                                    offset="5%"
                                    stopColor={colorVarMap[colorKey]}
                                    stopOpacity={0.3}
                                />
                                <stop
                                    offset="95%"
                                    stopColor={colorVarMap[colorKey]}
                                    stopOpacity={0}
                                />
                            </linearGradient>
                        )
                    })}
                </defs>
                {showGridLines && <CartesianGrid vertical={false} />}
                <XAxis
                    hide
                    dataKey={index}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    {...(startEndOnly ? { tickCount: 2, interval: "preserveStartEnd" } : { minTickGap: 32 })}
                />
                <YAxis
                    hide
                    allowDecimals={allowDecimals}
                    tickMargin={1}
                />
                <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="line" />}
                />
                {categories.map((cat) => (
                    <Area
                        key={cat}
                        dataKey={cat}
                        type="natural"
                        fill={`url(#fill-${cat})`}
                        stroke={`var(--color-${cat})`}
                        strokeWidth={1}
                    />
                ))}
                {showLegend && <ChartLegend content={<ChartLegendContent />} />}
            </RechartsAreaChart>
        </ChartContainer>
    )
}
