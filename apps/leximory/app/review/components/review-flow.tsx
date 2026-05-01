'use client'

import { useState, useCallback, useMemo, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Lawn, LawnRef } from './lawn'
import { WordPill, StoryPill } from './lawn-items'
import { StoryDrawer } from './story-drawer'
import { TranslationExercise } from './translation-popover'
import { useReviewProgress } from '../hooks/use-review-progress'
import { PiX } from 'react-icons/pi'
import { Spinner } from '@heroui/spinner'
import { Card, CardBody } from '@heroui/card'
import { Button } from '@heroui/button'
import { isTranslationCompleted, type ReviewTranslation } from '@/lib/review'

interface LawnItem {
    id: string
    type: 'story' | 'translation'
    label: string
    x: number
    y: number
    index?: number
    data: any
}

interface TranslationSession {
    id: string
    index: number
    data: ReviewTranslation
}

interface ReviewFlowProps {
    date: string
    lang: string
    onExit: () => void
}

export function ReviewFlow({ date, lang, onExit }: ReviewFlowProps) {
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
    const [showStory, setShowStory] = useState(false)
    const [showTranslation, setShowTranslation] = useState(false)
    const [pendingItemId, setPendingItemId] = useState<string | null>(null)
    const [activeTranslation, setActiveTranslation] = useState<TranslationSession | null>(null)

    const lawnRef = useRef<LawnRef>(null)
    const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const { progress, story, translations } = useReviewProgress({ date, lang })

    // Stable random positions stored in a ref, cleared when date/lang change
    const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())
    const dateLangRef = useRef(`${date}-${lang}`)
    if (dateLangRef.current !== `${date}-${lang}`) {
        positionsRef.current.clear()
        dateLangRef.current = `${date}-${lang}`
    }

    // Derive items directly from data — no useEffect state syncing needed
    const items = useMemo(() => {
        const result: LawnItem[] = []

        const getItemFootprint = (item: Pick<LawnItem, 'type' | 'label'>) => ({
            width: item.type === 'story'
                ? 20
                : Math.min(28, Math.max(12, 8 + item.label.length * 1.15)),
            height: item.type === 'story' ? 9 : 7,
        })

        const overlaps = (
            candidate: { type: LawnItem['type']; label: string; x: number; y: number },
            existing: LawnItem
        ) => {
            const candidateSize = getItemFootprint(candidate)
            const existingSize = getItemFootprint(existing)

            return (
                Math.abs(candidate.x - existing.x) < (candidateSize.width + existingSize.width) / 2 &&
                Math.abs(candidate.y - existing.y) < (candidateSize.height + existingSize.height) / 2
            )
        }

        const getPosition = (id: string, type: LawnItem['type'], label: string) => {
            let pos = positionsRef.current.get(id)
            if (!pos) {
                let attempts = 0
                let bestCandidate = { x: 50, y: 50, overlapCount: Number.POSITIVE_INFINITY }

                while (attempts < 40) {
                    const candidate = {
                        type,
                        label,
                        x: 16 + Math.random() * 68,
                        y: 22 + Math.random() * 54,
                    }
                    const overlapCount = result.filter((item) => overlaps(candidate, item)).length

                    if (overlapCount < bestCandidate.overlapCount) {
                        bestCandidate = { x: candidate.x, y: candidate.y, overlapCount }
                    }

                    if (overlapCount === 0) {
                        bestCandidate = { x: candidate.x, y: candidate.y, overlapCount }
                        break
                    }

                    attempts++
                }
                pos = { x: bestCandidate.x, y: bestCandidate.y }
                positionsRef.current.set(id, pos)
            }
            return pos
        }

        if (story) {
            const pos = getPosition('story', 'story', '故事')
            result.push({ id: 'story', type: 'story', label: '故事', x: pos.x, y: pos.y, data: story })
        }

        if (translations) {
            translations.forEach((translation, index) => {
                const id = `translation-${index}`
                const pos = getPosition(id, 'translation', translation.keyword)
                result.push({
                    id,
                    type: 'translation',
                    label: translation.keyword,
                    x: pos.x,
                    y: pos.y,
                    index,
                    data: translation satisfies ReviewTranslation,
                })
            })
        }

        return result
    }, [story, translations])

    const handleItemClick = useCallback((item: LawnItem) => {
        if (!lawnRef.current) return

        if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current)
            closeTimeoutRef.current = null
        }

        setSelectedItemId(item.id)
        setPendingItemId(item.id)

        if (item.type === 'story') {
            setActiveTranslation(null)
            setShowStory(true)
            setShowTranslation(false)
        } else {
            setActiveTranslation({
                id: item.id,
                index: item.index!,
                data: item.data as ReviewTranslation,
            })
            setShowTranslation(true)
            setShowStory(false)
        }

        lawnRef.current.moveTo(item.x, item.y)
    }, [])

    const handleClose = useCallback(() => {
        setShowStory(false)
        setShowTranslation(false)
        if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current)
        }
        closeTimeoutRef.current = setTimeout(() => {
            setSelectedItemId(null)
            setPendingItemId(null)
            closeTimeoutRef.current = null
        }, 500)
    }, [])

    const handleBackgroundClick = useCallback(() => {
        if (selectedItemId || showStory || showTranslation) {
            handleClose()
        }
    }, [selectedItemId, showStory, showTranslation, handleClose])

    const isGenerating = progress?.stage !== 'complete'
    const liveTranslation = useMemo(() => {
        if (!activeTranslation) return null
        const nextItem = items.find((item) => item.id === activeTranslation.id && item.type === 'translation')
        if (!nextItem || nextItem.type !== 'translation') {
            return activeTranslation
        }

        return {
            id: nextItem.id,
            index: nextItem.index!,
            data: nextItem.data as ReviewTranslation,
        }
    }, [activeTranslation, items])

    const statusText = {
        init: 'Initializing...',
        story: 'Writing story...',
        translations: 'Preparing translations...',
        complete: ''
    }[progress?.stage ?? 'init']

    return (
        <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="h-dvh w-full relative flex flex-col"
        >
            <Button
                radius='full'
                onPress={onExit}
                variant='flat'
                startContent={<PiX className="w-4 h-4" />}
                className="absolute top-6 left-6 z-50 px-4 py-2 backdrop-blur"
            >
                返回
            </Button>

            <AnimatePresence>
                {isGenerating && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        className="fixed top-24 left-1/2 -translate-x-1/2 z-50 px-4"
                    >
                        <Card shadow="none" className="bg-default-50 p-2 shadow-none border-7 border-default-200 rounded-4xl w-64 max-w-full">
                            <CardBody className="flex flex-row items-center gap-3 py-2 px-4">
                                <Spinner variant='spinner' size='sm' color='secondary' />
                                <span className="text-xs text-default-400 uppercase tracking-wide font-mono">
                                    {statusText}
                                </span>
                            </CardBody>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex-1 flex items-center justify-center p-4">
                <div className="relative w-full h-full max-w-4xl aspect-video">
                    <Lawn
                        ref={lawnRef}
                        fruits={[]}
                        onBackgroundClick={handleBackgroundClick}
                    />

                    <AnimatePresence>
                        {items.map((item, index) => (
                            item.type === 'story' ? (
                                <StoryPill
                                    key={item.id}
                                    id={item.id}
                                    x={item.x}
                                    y={item.y}
                                    delay={index * 0.1}
                                    onClick={() => handleItemClick(item)}
                                    isActive={pendingItemId === item.id}
                                />
                            ) : (
                                <WordPill
                                    key={item.id}
                                    id={item.id}
                                    word={item.label}
                                    x={item.x}
                                    y={item.y}
                                    delay={index * 0.1}
                                    onClick={() => handleItemClick(item)}
                                    isCompleted={item.type === 'translation' && isTranslationCompleted(item.data as ReviewTranslation)}
                                    isActive={pendingItemId === item.id}
                                />
                            )
                        ))}
                    </AnimatePresence>
                </div>
            </div>

            <StoryDrawer
                isOpen={showStory}
                onClose={handleClose}
                content={story}
                lang={lang}
            />

            <TranslationExercise
                date={date}
                lang={lang}
                isOpen={showTranslation}
                itemId={liveTranslation?.id}
                index={liveTranslation?.index}
                data={liveTranslation?.data}
            />
        </motion.div>
    )
}
