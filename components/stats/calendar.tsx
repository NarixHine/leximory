"use client"

import { useState } from "react"
import { PiNotebookDuotone } from 'react-icons/pi'
import { Card, CardBody } from '@heroui/card'
import { cn } from '@/lib/utils'
import { CHINESE_ZCOOL } from '@/lib/fonts'
import { formatChartData } from '.'

interface VocabularyCalendarProps {
    wordCountData: Map<string, number>
}

export default function VocabularyCalendar({ wordCountData }: VocabularyCalendarProps) {
    const [currentDate] = useState(new Date())

    // Get current month and year
    const currentMonth = currentDate.getMonth()
    const currentYear = currentDate.getFullYear()

    // Get the first day of the month
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1)
    const startingDayOfWeek = firstDayOfMonth.getDay()

    // Get the number of days in the month
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()

    // Create array of days for the current month
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

    // Create array for empty cells before the first day
    const emptyCells = Array.from({ length: startingDayOfWeek }, (_, i) => i)

    // Day names
    const dayNames = ["日", "一", "二", "三", "四", "五", "六"]

    // Color palette from the image
    const colorPalette = {
        0: 'bg-default-50/80',
        1: 'bg-primary-50',
        5: 'bg-primary-100',
        10: 'bg-primary-200',
        15: 'bg-primary-300',
        20: 'bg-primary-400',
        25: 'bg-primary-500',
        30: 'bg-primary-600',
        35: 'bg-primary-700',
        40: 'bg-primary-800',
        45: 'bg-primary-900',
    }

    // Function to determine cell color based on word count
    const getCellColor = (day: number) => {
        const dateString = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
        const count = wordCountData.get(dateString) || 0

        // Find the appropriate color based on count
        const thresholds = Object.keys(colorPalette)
            .map(Number)
            .sort((a, b) => a - b)
        let colorKey = thresholds[0]

        for (const threshold of thresholds) {
            if (count >= threshold) {
                colorKey = threshold
            } else {
                break
            }
        }

        return colorPalette[colorKey as keyof typeof colorPalette]
    }

    // Function to get text color based on word count
    const getTextColor = (day: number) => {
        const dateString = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
        const count = wordCountData.get(dateString) || 0

        // For darker backgrounds, use light text
        if (count >= 20) {
            return "text-default-100"
        }

        // For lighter backgrounds, use dark text
        return "text-default-800"
    }

    return (
        <Card className={cn(
            "backdrop-blur-md bg-white/80 dark:bg-default-50/80 border-0 shadow-lg rounded-3xl overflow-hidden",
            wordCountData.size === 0 && 'animate-pulse',
        )}>
            <CardBody className="p-6">
                <div className="grid grid-cols-7 gap-2">
                    {/* Day headers */}
                    {dayNames.map((day, index) => (
                        <div key={index} className={cn("text-center text-xs font-medium py-1", CHINESE_ZCOOL.className)}>
                            {day}
                        </div>
                    ))}

                    {/* Empty cells */}
                    {emptyCells.map((_, index) => (
                        <div key={`empty-${index}`} className="aspect-square rounded-md"></div>
                    ))}

                    {/* Day cells */}
                    {days.map((day) => {
                        const dateString = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                        const wordCount = wordCountData.get(dateString) || 0
                        const isToday = new Date().toDateString() === new Date(currentYear, currentMonth, day).toDateString()
                        const bgColor = getCellColor(day)
                        const textColor = getTextColor(day)

                        return (
                            <div
                                key={day}
                                className={cn(
                                    'aspect-square rounded-md flex items-center justify-center',
                                    textColor,
                                    'transition-all duration-200 hover:scale-105',
                                    isToday ? 'ring-1 ring-offset-1 ring-offset-background ring-gray-300 dark:ring-gray-600' : '',
                                    bgColor
                                )}
                            >
                                {wordCount > 0 ? (
                                    <div className="flex items-center text-xs">
                                        <PiNotebookDuotone className="h-3 w-3 mr-0.5" />
                                        {wordCount}
                                    </div>
                                ) : (
                                    ""
                                )}
                            </div>
                        )
                    })}
                </div>
            </CardBody>
        </Card>
    )
}

export function HeatmapSkeleton() {
    return <VocabularyCalendar wordCountData={new Map()} />
}
