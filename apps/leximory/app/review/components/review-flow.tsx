'use client'

import { useState, useCallback, useMemo, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useMediaQuery } from 'usehooks-ts'
import { Lawn, LawnRef } from './lawn'
import { CatTaskPill, WordPill, StoryPill } from './lawn-items'
import { StoryDrawer } from './story-drawer'
import { TranslationExercise } from './translation-popover'
import { ConversationExercise } from './conversation-popover'
import { useReviewProgress } from '../hooks/use-review-progress'
import { PiX } from 'react-icons/pi'
import { Spinner } from '@heroui/spinner'
import { Card, CardBody } from '@heroui/card'
import { Button } from '@heroui/button'
import {
    getConversationUnlockProgress,
    getReviewCompletion,
    isConversationCompleted,
    isTranslationCompleted,
    type ReviewConversation,
    type ReviewTranslation,
} from '@/lib/review'

interface LawnItem {
    id: string
    type: 'story' | 'translation' | 'conversation'
    label: string
    x: number
    y: number
    index?: number
    data: any
}

interface ReviewFlowProps {
    date: string
    lang: string
    onExit: () => void
}

type OpenPanel = 'story' | 'translation' | 'conversation' | null

function rotateLandscapePointToPortrait(x: number, y: number) {
    return {
        x: 100 - y,
        y: x,
    }
}

function hashSeed(str: string): number {
    let h = 0
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(31, h) + str.charCodeAt(i) | 0
    }
    return h
}

function makeRng(seed: number): () => number {
    let s = seed | 0
    return () => {
        s = (s * 1664525 + 1013904223) | 0
        return (s >>> 0) / 4294967296
    }
}

export function ReviewFlow({ date, lang, onExit }: ReviewFlowProps) {
    const [openPanel, setOpenPanel] = useState<OpenPanel>(null)
    const [pendingItemId, setPendingItemId] = useState<string | null>(null)

    const lawnRef = useRef<LawnRef>(null)
    const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const usePortraitLawn = useMediaQuery('(max-width: 767px)')

    const { progress, story, translations, conversation } = useReviewProgress({ date, lang })

    const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())

    const items = useMemo(() => {
        const result: LawnItem[] = []

        const getItemFootprint = (item: Pick<LawnItem, 'type' | 'label'>) => ({
            width: item.type === 'story'
                ? 20
                : item.type === 'conversation'
                    ? 26
                    : Math.min(28, Math.max(12, 8 + item.label.length * 1.15)),
            height: item.type === 'story' ? 9 : item.type === 'conversation' ? 12 : 7,
        })

        const overlaps = (
            candidate: { type: LawnItem['type']; label: string; x: number; y: number },
            existing: LawnItem
        ) => {
            const candidateSize = getItemFootprint(candidate)
            const existingSize = getItemFootprint(existing)
            const buffer = 10

            return (
                Math.abs(candidate.x - existing.x) < (candidateSize.width + existingSize.width) / 2 + buffer &&
                Math.abs(candidate.y - existing.y) < (candidateSize.height + existingSize.height) / 2 + buffer
            )
        }

        const dayHash = hashSeed(`${date}-${lang}`)

        const getPosition = (id: string, type: LawnItem['type'], label: string) => {
            const cached = positionsRef.current.get(id)
            if (cached) return cached

            const rng = makeRng(hashSeed(`${dayHash}-${id}`))
            let attempts = 0
            let bestCandidate = { x: 50, y: 50, overlapCount: Number.POSITIVE_INFINITY }

            while (attempts < 60) {
                const candidate = {
                    type,
                    label,
                    x: usePortraitLawn ? 10 + rng() * 80 : 20 + rng() * 60,
                    y: usePortraitLawn ? 46 + rng() * 40 : 26 + rng() * 40,
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
            const pos = { x: bestCandidate.x, y: bestCandidate.y }
            positionsRef.current.set(id, pos)
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

        if (conversation) {
            const pos = getPosition('conversation', 'conversation', '每日练笔')
            result.push({
                id: 'conversation',
                type: 'conversation',
                label: '每日练笔',
                x: pos.x,
                y: pos.y,
                data: conversation,
            })
        }

        return result
    }, [date, lang, story, translations, conversation])

    const unlockProgress = useMemo(
        () => getConversationUnlockProgress(translations),
        [translations]
    )
    const reviewCompletion = useMemo(
        () => getReviewCompletion({ story, translations, conversation }),
        [story, translations, conversation]
    )

    const displayItems = useMemo(
        () => items.map((item) => {
            const rotated = usePortraitLawn
                ? rotateLandscapePointToPortrait(item.x, item.y)
                : { x: item.x, y: item.y }

            return {
                item,
                displayX: rotated.x,
                displayY: rotated.y,
            }
        }),
        [items, usePortraitLawn]
    )

    const handleItemClick = useCallback((item: LawnItem) => {
        if (!lawnRef.current) return

        if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current)
            closeTimeoutRef.current = null
        }

        setPendingItemId(item.id)
        setOpenPanel(item.type)

        const targetPosition = usePortraitLawn
            ? rotateLandscapePointToPortrait(item.x, item.y)
            : { x: item.x, y: item.y }

        lawnRef.current.moveTo(targetPosition.x, targetPosition.y)
    }, [usePortraitLawn])

    const handleClose = useCallback(() => {
        setOpenPanel(null)
        if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current)
        }
        closeTimeoutRef.current = setTimeout(() => {
            setPendingItemId(null)
            closeTimeoutRef.current = null
        }, 500)
    }, [])

    const isGenerating = progress?.stage !== 'complete'
    const liveTranslation = useMemo(() => {
        if (openPanel !== 'translation' || !pendingItemId) return null
        const item = items.find((i) => i.id === pendingItemId && i.type === 'translation')
        if (!item || item.type !== 'translation') return null
        return {
            id: item.id,
            index: item.index!,
            data: item.data as ReviewTranslation,
        }
    }, [openPanel, pendingItemId, items])

    const statusText = {
        init: 'Initializing...',
        story: 'Writing story...',
        translations: 'Preparing translations...',
        conversation: 'Waiting for the dark cat...',
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

            <div className="flex-1 flex items-center justify-center px-3 py-4 sm:p-4">
                <div className="relative w-full max-w-136 max-h-full aspect-3/4 md:h-full md:max-w-4xl md:aspect-video">
                    <Lawn
                        key={usePortraitLawn ? 'portrait-lawn' : 'landscape-lawn'}
                        ref={lawnRef}
                        fruits={[]}
                        isPortrait={usePortraitLawn}
                    />

                    <AnimatePresence>
                        {displayItems.map(({ item, displayX, displayY }, index) => (
                            item.type === 'story' ? (
                                <StoryPill
                                    key={item.id}
                                    id={item.id}
                                    x={displayX}
                                    y={displayY}
                                    delay={index * 0.1}
                                    onClick={() => handleItemClick(item)}
                                    isActive={pendingItemId === item.id}
                                />
                            ) : item.type === 'conversation' ? (
                                <CatTaskPill
                                    key={item.id}
                                    id={item.id}
                                    x={displayX}
                                    y={displayY}
                                    delay={index * 0.1}
                                    onClick={() => handleItemClick(item)}
                                    isLocked={!unlockProgress.isUnlocked}
                                    isCompleted={isConversationCompleted(item.data as ReviewConversation)}
                                />
                            ) : (
                                <WordPill
                                    key={item.id}
                                    id={item.id}
                                    word={item.label}
                                    x={displayX}
                                    y={displayY}
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
                isOpen={openPanel === 'story'}
                onClose={handleClose}
                content={story}
                lang={lang}
            />

            <TranslationExercise
                date={date}
                lang={lang}
                isOpen={openPanel === 'translation'}
                onClose={handleClose}
                itemId={liveTranslation?.id}
                index={liveTranslation?.index}
                data={liveTranslation?.data}
            />

            <ConversationExercise
                date={date}
                lang={lang}
                isOpen={openPanel === 'conversation'}
                onClose={handleClose}
                data={conversation}
                translations={translations}
                isLocked={!unlockProgress.isUnlocked}
            />
        </motion.div>
    )
}
