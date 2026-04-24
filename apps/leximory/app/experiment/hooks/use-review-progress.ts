'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'

interface ReviewProgress {
    stage: 'init' | 'story' | 'translations' | 'complete'
    story?: string
    translations?: Array<{
        chinese: string
        answer: string
        keyword: string
    }>
}

interface CheckResponse {
    exists: boolean
    story?: string
    translations?: ReviewProgress['translations']
}

async function checkReviewData(date: string, lang: string): Promise<CheckResponse> {
    const res = await fetch(`/api/review/check?date=${date}&lang=${lang}`)
    if (!res.ok) throw new Error('Failed to check review data')
    return res.json()
}

async function startReviewGeneration(date: string, lang: string) {
    const res = await fetch('/api/review/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, lang })
    })
    if (!res.ok) throw new Error('Failed to start generation')
    return res.json()
}

export function useReviewProgress({ date, lang }: { date: string | null; lang: string | null }) {
    const [sseProgress, setSseProgress] = useState<ReviewProgress | null>(null)

    const checkQuery = useQuery({
        queryKey: ['review', 'check', date, lang],
        queryFn: () => checkReviewData(date!, lang!),
        enabled: !!date && !!lang,
        staleTime: Infinity,
    })

    const startMutation = useMutation({
        mutationFn: () => startReviewGeneration(date!, lang!),
    })

    // Auto-start generation when check confirms no cached data exists.
    // TanStack Query deduplicates the check request automatically.
    // Mutation state guards against duplicate start calls.
    useEffect(() => {
        if (!checkQuery.isSuccess || !checkQuery.data) return
        if (checkQuery.data.exists) return
        if (startMutation.isPending || startMutation.isSuccess) return

        startMutation.mutate()
    }, [checkQuery.isSuccess, checkQuery.data, startMutation])

    // Subscribe to SSE for real-time progress updates
    useEffect(() => {
        if (!date || !lang) return

        const shouldConnect = checkQuery.data?.exists || startMutation.isSuccess
        if (!shouldConnect) return

        const eventSource = new EventSource(`/api/review/progress?date=${date}&lang=${lang}`)

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                if (data.type === 'connected') return
                setSseProgress(data)
            } catch (error) {
                console.error('Error parsing SSE data:', error)
            }
        }

        eventSource.onerror = () => {
            eventSource.close()
        }

        return () => {
            eventSource.close()
        }
    }, [date, lang, checkQuery.data?.exists, startMutation.isSuccess])

    const progress: ReviewProgress = checkQuery.data?.exists
        ? { stage: 'complete', story: checkQuery.data.story, translations: checkQuery.data.translations }
        : (sseProgress ?? { stage: 'init' })

    return {
        progress,
        isLoading: checkQuery.isLoading || startMutation.isPending,
        hasCheckedCache: checkQuery.isSuccess,
        story: progress.story,
        translations: progress.translations,
    }
}
