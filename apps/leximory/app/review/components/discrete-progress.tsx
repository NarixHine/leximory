'use client'

import { cn } from '@/lib/utils'
import { PiCursorClick, PiStar, PiStarFill } from 'react-icons/pi'
import { getLanguageStrategy } from '@/lib/languages/strategies'
import type { Lang } from '@repo/env/config'

interface DiscreteProgressProps {
    value: number
    lang?: Lang
    showLang?: boolean
    onClick?: () => void
    conversationCompleted?: boolean
}

export function DiscreteProgress({
    value,
    lang,
    showLang = true,
    onClick,
    conversationCompleted,
}: DiscreteProgressProps) {
    const state = value < 1 ? 0 : value < 30 ? 1 : value < 60 ? 2 : 3
    const langCode = lang ? getLanguageStrategy(lang).type : null

    const bar = (
        <div className="flex items-center gap-0.5">
            <div className={cn(
                "h-2 w-8 rounded-l transition-colors",
                state >= 1 ? "bg-default-400" : "bg-default-200"
            )} />
            <div className={cn(
                "h-2 w-8 rounded-none transition-colors",
                state >= 2 ? "bg-default-400" : "bg-default-200"
            )} />
            <div className={cn(
                "h-2 w-8 rounded-r transition-colors",
                state >= 3 ? "bg-default-400" : "bg-default-200"
            )} />
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
