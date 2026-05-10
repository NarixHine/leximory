'use client'

import { cn } from '@/lib/utils'
import { PiCursorClick, PiStar, PiStarFill } from 'react-icons/pi'
import { getLanguageStrategy } from '@/lib/languages/strategies'
import type { Lang } from '@repo/env/config'

interface DiscreteProgressProps {
    value: number
    lang?: Lang
    showLang?: boolean
    showThresholdLabels?: boolean
    onClick?: () => void
    conversationCompleted?: boolean
}

const thresholdLabels = ['1%', '30%', '60%'] as const

export function DiscreteProgress({
    value,
    lang,
    showLang = true,
    showThresholdLabels = false,
    onClick,
    conversationCompleted,
}: DiscreteProgressProps) {
    const state = value < 1 ? 0 : value < 30 ? 1 : value < 60 ? 2 : 3
    const langCode = lang ? getLanguageStrategy(lang).type : null

    const segments = [1, 2, 3] as const
    const bar = (
        <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-0.5">
                {segments.map((segment) => (
                    <div
                        key={segment}
                        className={cn(
                            "h-2 w-8 transition-colors",
                            segment === 1 && "rounded-l",
                            segment === 3 && "rounded-r",
                            state >= segment ? "bg-default-400" : "bg-default-200"
                        )}
                    />
                ))}
            </div>
            {showThresholdLabels && (
                <div className="grid w-25 grid-cols-3 gap-0.5 text-center font-mono text-xs leading-none text-default-400">
                    {thresholdLabels.map((label) => (
                        <span key={label}>{label}</span>
                    ))}
                </div>
            )}
        </div>
    )

    const icon = conversationCompleted ? (
        <PiStarFill className="w-4 h-4 text-default-400" />
    ) : state >= 3 ? (
        <PiStar className="w-4 h-4 text-default-400" />
    ) : (
        <PiCursorClick className="w-4 h-4 text-default-400 group-hover:text-default-500 transition-colors" />
    )

    if (onClick) {
        return (
            <button
                onClick={onClick}
                className="flex items-center gap-2 group cursor-pointer"
            >
                {showLang && langCode && (
                    <span className="text-sm font-mono uppercase text-default-500">
                        {langCode}
                    </span>
                )}
                {bar}
                {icon}
            </button>
        )
    }

    return (
        <div className="flex items-center gap-2">
            {showLang && langCode && (
                <span className="text-sm font-mono uppercase text-default-500">
                    {langCode}
                </span>
            )}
            {bar}
            {icon}
        </div>
    )
}
