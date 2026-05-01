'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import type { ReviewConversation, ReviewTranslation } from '@/lib/review'

interface ReviewProgress {
    stage: 'init' | 'story' | 'translations' | 'conversation' | 'complete'
    story?: string
    translations?: ReviewTranslation[]
    conversation?: ReviewConversation | null
}

interface CheckResponse {
    exists: boolean
    inProgress?: boolean
    stage?: ReviewProgress['stage']
    story?: string
    translations?: ReviewProgress['translations']
    conversation?: ReviewProgress['conversation']
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

    useEffect(() => {
        setSseProgress(null)
    }, [date, lang])

    const checkQuery = useQuery({
        queryKey: ['review', 'check', date, lang],
        queryFn: () => checkReviewData(date!, lang!),
        enabled: !!date && !!lang,
        staleTime: 0,
        refetchInterval: (query) => {
            const data = query.state.data
            if (!data?.exists) return false
            const hasPendingTranslation = data.translations?.some(translation => translation.status === 'pending')
            const hasPendingConversation = data.conversation?.status === 'pending'
            return hasPendingTranslation || hasPendingConversation ? 1500 : false
        },
    })

    const startMutation = useMutation({
        mutationFn: () => startReviewGeneration(date!, lang!),
    })

    // Auto-start generation when check confirms no cached data exists.
    // TanStack Query deduplicates the check request automatically.
    // Mutation state guards against duplicate start calls.
    useEffect(() => {
        if (!checkQuery.isSuccess || !checkQuery.data) return
        if (checkQuery.data.exists || checkQuery.data.inProgress) return
        if (startMutation.isPending || startMutation.isSuccess) return

        startMutation.mutate()
    }, [checkQuery.isSuccess, checkQuery.data, startMutation])

    // Subscribe to SSE for real-time progress updates
    useEffect(() => {
        if (!date || !lang) return

        const shouldConnect = checkQuery.data?.exists || checkQuery.data?.inProgress || startMutation.isSuccess
        if (!shouldConnect) return

        const eventSource = new EventSource(`/api/review/progress?date=${date}&lang=${lang}`)

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                if (data.type === 'connected') return
                setSseProgress((previous) => ({
                    stage: data.stage ?? previous?.stage ?? 'init',
                    story: data.story ?? previous?.story,
                    translations: data.translations ?? previous?.translations,
                    conversation: data.conversation ?? previous?.conversation,
                }))
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
    }, [date, lang, checkQuery.data?.exists, checkQuery.data?.inProgress, startMutation.isSuccess])

    const queryProgress: ReviewProgress | null = checkQuery.data?.exists || checkQuery.data?.inProgress
        ? {
            stage: checkQuery.data.stage ?? (checkQuery.data.exists ? 'complete' : 'init'),
            story: checkQuery.data.story,
            translations: checkQuery.data.translations,
            conversation: checkQuery.data.conversation,
        }
        : null

    const liveProgress: ReviewProgress = queryProgress
        ? {
            stage: sseProgress?.stage ?? queryProgress.stage,
            story: sseProgress?.story ?? queryProgress.story,
            translations: sseProgress?.translations ?? queryProgress.translations,
            conversation: sseProgress?.conversation ?? queryProgress.conversation,
        }
        : (sseProgress ?? { stage: 'init' })

    if (queryProgress?.stage === 'complete' && sseProgress?.stage === 'complete') {
        liveProgress.stage = 'complete'
    }

    return {
        progress: liveProgress,
        isLoading: checkQuery.isLoading || startMutation.isPending,
        hasCheckedCache: checkQuery.isSuccess,
        story: liveProgress.story,
        translations: liveProgress.translations,
        conversation: liveProgress.conversation,
    }
}
