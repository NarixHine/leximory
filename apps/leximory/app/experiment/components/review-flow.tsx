'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Lawn, LawnRef } from './lawn'
import { WordPill, StoryPill } from './lawn-items'
import { StoryDrawer } from './story-drawer'
import { TranslationExercise } from './translation-popover'
import { useReviewProgress } from '../hooks/use-review-progress'
import { PiX } from 'react-icons/pi'

interface LawnItem {
    id: string
    type: 'story' | 'translation'
    label: string
    x: number
    y: number
    data: any
}

interface ReviewFlowProps {
    date: string
    lang: string
    onExit: () => void
}

export function ReviewFlow({ date, lang, onExit }: ReviewFlowProps) {
    const [items, setItems] = useState<LawnItem[]>([])
    const [selectedItem, setSelectedItem] = useState<LawnItem | null>(null)
    const [showStory, setShowStory] = useState(false)
    const [showTranslation, setShowTranslation] = useState(false)
    const [pendingItem, setPendingItem] = useState<LawnItem | null>(null)
    const addedIdsRef = useRef<Set<string>>(new Set())

    const lawnRef = useRef<LawnRef>(null)

    const { progress, story, translations } = useReviewProgress({ date, lang })

    // Generate random position that doesn't overlap too much
    const generatePosition = useCallback((existingItems: LawnItem[]) => {
        let attempts = 0
        let x: number, y: number
        do {
            x = 15 + Math.random() * 70
            y = 20 + Math.random() * 60
            attempts++
        } while (attempts < 10 && existingItems.some(item => {
            const dx = item.x - x
            const dy = item.y - y
            return Math.sqrt(dx * dx + dy * dy) < 12
        }))
        return { x, y }
    }, [])

    useEffect(() => {
        if (story && !addedIdsRef.current.has('story')) {
            addedIdsRef.current.add('story')
            const { x, y } = generatePosition(items)
            setItems(prev => [...prev, { id: 'story', type: 'story', label: '故事', x, y, data: story }])
        }
    }, [story, items, generatePosition])

    useEffect(() => {
        if (!translations) return

        translations.forEach((translation: any, index: number) => {
            const id = `translation-${index}`
            if (!addedIdsRef.current.has(id)) {
                addedIdsRef.current.add(id)
                setTimeout(() => {
                    setItems(prev => {
                        const { x, y } = generatePosition(prev)
                        return [...prev, {
                            id,
                            type: 'translation',
                            label: translation.keyword,
                            x, y,
                            data: translation
                        }]
                    })
                }, index * 200)
            }
        })
    }, [translations, generatePosition])

    // Handle item click - move cat NEAR the item (stops short)
    const handleItemClick = useCallback((item: LawnItem) => {
        if (!lawnRef.current) return

        setPendingItem(item)

        // Move cat NEAR the item with buffer distance (stops short)
        lawnRef.current.moveNear(item.x, item.y, 60, () => {
            handleCatArrived(item)
        })
    }, [])

    // Called when cat arrives near an item
    const handleCatArrived = useCallback((item: LawnItem) => {
        setSelectedItem(item)
        setPendingItem(null)

        if (item.type === 'story') {
            setShowStory(true)
            setShowTranslation(false)
        } else {
            setShowTranslation(true)
            setShowStory(false)
        }
    }, [])

    const handleClose = useCallback(() => {
        setShowStory(false)
        setShowTranslation(false)
        // set null with a delay to allow popover exit animation to finish
        setTimeout(() => {
            setSelectedItem(null)
            setPendingItem(null)
        }, 300)
    }, [])

    const isGenerating = progress?.stage !== 'complete'

    return (
        <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="h-dvh w-full relative flex flex-col"
        >
            {/* Header */}
            <button
                onClick={onExit}
                className="absolute top-6 left-6 z-50 px-4 py-2 bg-background/80 backdrop-blur rounded-full text-sm text-default-600 hover:bg-background transition-colors flex items-center gap-2"
            >
                <PiX className="w-4 h-4" />
                <span>返回</span>
            </button>

            <AnimatePresence>
                {isGenerating && (
                    <div className="absolute top-6 right-6 z-50 flex items-center gap-3 px-4 py-2 bg-background/80 backdrop-blur rounded-full">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-default-600">
                            {progress?.stage === 'story' ? '编写故事中...' :
                                progress?.stage === 'translations' ? '创建练习...' :
                                    '准备中...'}
                        </span>
                    </div>
                )}
            </AnimatePresence>

            {/* Lawn with items on it */}
            <div className="flex-1 flex items-center justify-center p-4">
                <div className="relative w-full h-full max-w-4xl aspect-video">
                    <Lawn
                        ref={lawnRef}
                        fruits={[]}
                    />

                    {/* Items positioned on the lawn */}
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
                                    isActive={pendingItem?.id === item.id}
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
                                    isActive={pendingItem?.id === item.id}
                                />
                            )
                        ))}
                    </AnimatePresence>
                </div>
            </div>

            <StoryDrawer
                isOpen={showStory}
                onClose={handleClose}
                content={selectedItem?.data}
            />

            <TranslationExercise
                isOpen={showTranslation}
                onClose={handleClose}
                data={selectedItem?.data}
            />
        </motion.div>
    )
}
