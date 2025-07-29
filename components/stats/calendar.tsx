'use client'

import { PiBookBookmark } from 'react-icons/pi'
import { CardBody } from '@heroui/card'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { momentSH } from '@/lib/moment'
import FlatCard from '../ui/flat-card'

interface VocabularyCalendarProps {
    wordCountData: Map<string, number>
    isLoading?: boolean
}

// Color palette for heatmap cells
const colorPalette = {
    0: 'bg-default-100/60',
    1: 'bg-primary-50',
    5: 'bg-primary-100',
    10: 'bg-primary-200',
    15: 'bg-primary-300',
    20: 'bg-primary-400',
    25: 'bg-primary-500',
    30: 'bg-primary-600',
    35: 'bg-primary-700',
    40: 'bg-primary-800',
    45: 'bg-primary-900'
}

// Function to determine cell color based on word count
function getCellColor(count: number): string {
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

// Function to get text color based on word count for contrast
function getTextColor(count: number): string {
    // For darker backgrounds, use light text
    if (count >= 20) {
        return 'text-default-100'
    }
    // For lighter backgrounds, use dark text
    return 'text-default-800'
}

export default function VocabularyCalendar({ wordCountData, isLoading }: VocabularyCalendarProps) {
    const [today] = useState(momentSH())
    const currentMonth = today.month() // 0-indexed
    const currentYear = today.year()

    // Get the first day of the month and its day of the week (0=Sun, 6=Sat)
    const firstDayOfMonth = today.clone().startOf('month')
    const startingDayOfWeek = firstDayOfMonth.day()

    // Get the number of days in the current month
    const daysInMonth = today.daysInMonth()

    // Create array of day numbers for the current month
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

    // Create array for empty cells before the first day
    const emptyCells = Array.from({ length: startingDayOfWeek }, (_, i) => i)

    // Day names (adjust if your week starts on Monday)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    return (
        <FlatCard background='solid' className={cn(
            'border-none bg-primary-100/20 dark:bg-stone-800',
            isLoading && 'animate-pulse'
        )}>
            <CardBody className='p-6 pt-4'>
                <div className='grid grid-cols-7 gap-2'>
                    {/* Day headers */}
                    {dayNames.map((day, index) => (
                        <div key={index} className={cn('text-center text-xs font-medium text-default-500 font-mono py-1',)}>
                            {day}
                        </div>
                    ))}

                    {/* Empty cells */}
                    {emptyCells.map((_, index) => (
                        <div key={`empty-${index}`} className='aspect-square rounded-md'></div>
                    ))}

                    {/* Day cells */}
                    {days.map((day) => {
                        const dayMoment = momentSH({ year: currentYear, month: currentMonth, day })
                        const dateString = dayMoment.format('YYYY-MM-DD')
                        const wordCount = wordCountData.get(dateString) || 0
                        const isToday = momentSH().isSame(dayMoment, 'day')
                        const bgColor = getCellColor(wordCount)
                        const textColor = getTextColor(wordCount)

                        return (
                            <div
                                key={day}
                                className={cn(
                                    'aspect-square rounded-md flex items-center justify-center',
                                    'text-xs', // Smaller text for the count
                                    textColor,
                                    'transition-all duration-200 hover:scale-105',
                                    isToday ? 'ring-1 ring-offset-1 ring-offset-background ring-gray-300 dark:ring-gray-600' : '',
                                    bgColor
                                )}
                            >
                                {wordCount > 0 ? (
                                    <div className='flex items-center gap-0.5'>
                                        <PiBookBookmark />
                                        {wordCount}
                                    </div>
                                ) : (
                                    '' // Render nothing if count is 0
                                )}
                            </div>
                        )
                    })}
                </div>
            </CardBody>
        </FlatCard>
    )
}

export function HeatmapSkeleton() {
    // Render the calendar in a loading state
    return <VocabularyCalendar wordCountData={new Map()} isLoading={true} />
}
