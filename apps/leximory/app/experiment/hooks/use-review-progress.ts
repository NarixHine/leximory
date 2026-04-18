'use client'

import { useState, useEffect } from 'react'

interface ReviewProgress {
    stage: 'init' | 'story' | 'translations' | 'complete'
    story?: string
    translations?: Array<{
        chinese: string
        answer: string
        keyword: string
    }>
}

export function useReviewProgress({ date, lang }: { date: string | null; lang: string | null }) {
    const [progress, setProgress] = useState<ReviewProgress>({ stage: 'init' })
    const [isConnected, setIsConnected] = useState(false)
    const [hasCheckedCache, setHasCheckedCache] = useState(false)

    useEffect(() => {
        if (!date || !lang) return

        // Check if data already exists before starting generation
        const checkAndStart = async () => {
            try {
                // First, check if we already have the data
                const checkRes = await fetch(`/api/experiment/review/check?date=${date}&lang=${lang}`)

                if (checkRes.ok) {
                    const checkData = await checkRes.json()

                    if (checkData.exists) {
                        // Data exists - set complete immediately without calling start
                        setProgress({
                            stage: 'complete',
                            story: checkData.story,
                            translations: checkData.translations,
                        })
                        setHasCheckedCache(true)
                        return
                    }
                }

                // No existing data - start generation
                const startRes = await fetch('/api/experiment/review/start', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date, lang })
                })

                if (!startRes.ok) {
                    console.error('Failed to start generation')
                }
                setHasCheckedCache(true)
            } catch (error) {
                console.error('Error checking/starting generation:', error)
                setHasCheckedCache(true)
            }
        }

        checkAndStart()

        // Connect to SSE endpoint for real-time updates
        const eventSource = new EventSource(`/api/experiment/review/progress?date=${date}&lang=${lang}`)

        eventSource.onopen = () => {
            setIsConnected(true)
        }

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                setProgress(data)
            } catch (error) {
                console.error('Error parsing SSE data:', error)
            }
        }

        eventSource.onerror = () => {
            setIsConnected(false)
            eventSource.close()
        }

        return () => {
            eventSource.close()
        }
    }, [date, lang])

    return {
        progress,
        isConnected,
        hasCheckedCache,
        story: progress.story,
        translations: progress.translations
    }
}
