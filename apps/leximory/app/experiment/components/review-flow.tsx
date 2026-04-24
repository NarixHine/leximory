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
    const [selectedItem, setSelectedItem] = useState<LawnItem | null>(null)
    const [showStory, setShowStory] = useState(false)
    const [showTranslation, setShowTranslation] = useState(false)
    const [pendingItem, setPendingItem] = useState<LawnItem | null>(null)

    const lawnRef = useRef<LawnRef>(null)

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

        const getPosition = (id: string) => {
            let pos = positionsRef.current.get(id)
            if (!pos) {
                let attempts = 0
                let x: number, y: number
                do {
                    x = 15 + Math.random() * 70
                    y = 20 + Math.random() * 60
                    attempts++
                } while (
                    attempts < 10 &&
                    result.some(item => {
                        const dx = item.x - x
                        const dy = item.y - y
                        return Math.sqrt(dx * dx + dy * dy) < 12
                    })
                )
                pos = { x, y }
                positionsRef.current.set(id, pos)
            }
            return pos
        }

        if (story) {
            const pos = getPosition('story')
            result.push({ id: 'story', type: 'story', label: '故事', x: pos.x, y: pos.y, data: story })
        }

        if (translations) {
            translations.forEach((translation, index) => {
                const id = `translation-${index}`
                const pos = getPosition(id)
                result.push({
                    id,
                    type: 'translation',
                    label: translation.keyword,
                    x: pos.x,
                    y: pos.y,
                    data: translation
                })
            })
        }

        return result
    }, [story, translations])

    const handleItemClick = useCallback((item: LawnItem) => {
        if (!lawnRef.current) return

        setSelectedItem(item)
        setPendingItem(item)

        if (item.type === 'story') {
            setShowStory(true)
            setShowTranslation(false)
        } else {
            setShowTranslation(true)
            setShowStory(false)
        }

        lawnRef.current.moveTo(item.x, item.y)
    }, [])

    const handleClose = useCallback(() => {
        setShowStory(false)
        setShowTranslation(false)
        setTimeout(() => {
            setSelectedItem(null)
            setPendingItem(null)
        }, 500)
    }, [])

    const handleBackgroundClick = useCallback(() => {
        if (selectedItem || showStory || showTranslation) {
            handleClose()
        }
    }, [selectedItem, showStory, showTranslation, handleClose])

    const isGenerating = progress?.stage !== 'complete'

    const statusText = {
        init: 'Initializing...',
        story: 'Generating story...',
        translations: 'Generating exercises...',
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
                lang={lang}
            />

            <TranslationExercise
                isOpen={showTranslation}
                onClose={handleClose}
                data={selectedItem?.data}
            />
        </motion.div>
    )
}
