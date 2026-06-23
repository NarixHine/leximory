'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@heroui/button'
import { Input } from '@heroui/input'
import { Select, SelectItem } from '@heroui/select'
import { Card, CardBody } from '@heroui/card'
import { motion, Transition } from 'framer-motion'
import {
    PiLinkDuotone,
    PiPackageDuotone,
    PiAirplaneTakeoffDuotone,
    PiMouseSimpleDuotone,
    PiMouseLeftClickDuotone,
    PiCheckCircleDuotone,
} from 'react-icons/pi'
import confetti from 'canvas-confetti'
import ScopeProvider from '@/components/jotai/scope-provider'
import { HydrationBoundary } from 'jotai-ssr'
import { langAtom } from '@/app/library/[lib]/atoms'
import { lexiconAtom } from '@/app/library/[lib]/[text]/atoms'
import Markdown from '@/components/markdown'

const HeroAnnotation =
    'Comprehensible input is the {{bedrock||bedrock||**n. 基石** `ˈbedˌrɑːk` the fundamental principles on which something is based||语源"基岩": ***bed*** (底座) + ***rock*** (岩石)}} of language acquisition. It {{asserts||assert||**v. 断言** `əˈsɜːrt` state a fact or belief confidently and forcefully||语源"将手放在……之上": ***ad-*** (to) + ***ser*** (join, plant)||***ser*** (join) → **ser**ies (系列), ex**ert** (运用)}} that learners progress by processing abundant material. By prioritizing meaning over mechanics, it bypasses {{cognitive strain||cognitive strain||**phr. 认知负荷** the mental effort required to process information||***cognitive*** 来自 ***co-*** (together) + ***gnos*** (know); ***strain*** 来自 ***stringere*** (draw tight)||***gnos*** (know) → **dia**gnosis (诊断); ***string*** (tight) → **strict** (严厉的)}} , cultivates subconscious {{internalization||internalization||**n. 内化** `ɪnˌtɜːrnələˈzeɪʃn` the process of making an attitude or belief part of their own character||语源"使之进入内部": ***inter-*** (within) + ***-al*** (adj. suffix) + ***-ize*** (v. suffix) + ***-ation*** (n. suffix)||***inter-*** (within) → **inter**ior (内部的)}}.'

const TRANSITION: Transition = {
    duration: 0.2,
    ease: [0.3, 0.72, 0, 1],
}

// Function to safely stream text character by character while preserving annotation boundaries
function getStreamSafeCharacters(text: string): string[] {
    const streamingSteps: string[] = []
    let currentText = ''
    let i = 0

    while (i < text.length) {
        const char = text[i]
        const nextChar = text[i + 1]

        // Start of annotation
        if (char === '{' && nextChar === '{') {
            // Find the complete annotation
            let annotationEnd = i + 2
            let braceCount = 1

            while (annotationEnd < text.length && braceCount > 0) {
                if (text[annotationEnd] === '{' && text[annotationEnd + 1] === '{') {
                    braceCount++
                    annotationEnd += 2
                } else if (text[annotationEnd] === '}' && text[annotationEnd + 1] === '}') {
                    braceCount--
                    annotationEnd += 2
                } else {
                    annotationEnd++
                }
            }

            // Extract the full annotation
            const fullAnnotation = text.slice(i, annotationEnd)

            // Find the word part (before first ||)
            const firstPipeIndex = fullAnnotation.indexOf('||')
            if (firstPipeIndex > 2) {
                // Make sure it's after the opening {{
                const wordPart = fullAnnotation.slice(2, firstPipeIndex) // Skip {{, get the word
                const restPart = fullAnnotation.slice(firstPipeIndex) // Everything from first || including}}

                // Stream the word character by character, building complete text each time
                for (let j = 1; j <= wordPart.length; j++) {
                    const partialWord = wordPart.slice(0, j)
                    const partialAnnotation = '{{' + partialWord + restPart
                    streamingSteps.push(currentText + partialAnnotation)
                }

                // Add the complete annotation to current text for future steps
                currentText += fullAnnotation
            } else {
                // Fallback: treat as single unit if no || found
                currentText += fullAnnotation
                streamingSteps.push(currentText)
            }

            i = annotationEnd
            continue
        }

        // Regular character
        currentText += char
        streamingSteps.push(currentText)
        i++
    }

    return streamingSteps
}

function StreamingText({ text, onComplete }: { text: string; onComplete?: () => void }) {
    const [displayedText, setDisplayedText] = useState('')
    const completedRef = useRef(false)

    useEffect(() => {
        // Reset completion status when text changes
        completedRef.current = false

        const streamSteps = getStreamSafeCharacters(text)
        let stepIndex = 0

        const streamInterval = setInterval(() => {
            if (stepIndex < streamSteps.length) {
                setDisplayedText(streamSteps[stepIndex])
                stepIndex++
            } else {
                clearInterval(streamInterval)
                if (!completedRef.current && onComplete) {
                    completedRef.current = true
                    onComplete()
                }
            }
        }, 5) // Faster interval for character-by-character streaming

        return () => clearInterval(streamInterval)
    }, [text]) // Only depend on text, not onComplete

    return (
        <ScopeProvider atoms={[langAtom, lexiconAtom]}>
            <HydrationBoundary
                hydrateAtoms={[
                    [langAtom, 'en'],
                    [lexiconAtom, 'none'],
                ]}
            >
                <Markdown disableSave md={displayedText} />
            </HydrationBoundary>
        </ScopeProvider>
    )
}

function AnimatedLearnMoreButton() {
    const handleScrollToContent = () => {
        document.getElementById('content-section')?.scrollIntoView({
            behavior: 'smooth',
        })
    }

    return (
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
                radius='full'
                variant='light'
                size='lg'
                className='animate-pulse text-default-600 hover:text-primary-600 transition-colors'
                startContent={<PiMouseSimpleDuotone className='text-2xl' />}
                onPress={handleScrollToContent}
            >
                继续
            </Button>
        </motion.div>
    )
}

export default function HeroImportUI() {
    const [isImporting, setIsImporting] = useState(false)
    const [showAnnotation, setShowAnnotation] = useState(false)
    const [streamingComplete, setStreamingComplete] = useState(false)
    const buttonRef = useRef<HTMLButtonElement>(null)

    const handleStreamingComplete = useCallback(() => {
        setStreamingComplete(true)
    }, [])

    const triggerConfetti = () => {
        if (!buttonRef.current) return

        const rect = buttonRef.current.getBoundingClientRect()
        const x = (rect.left + rect.width / 2) / window.innerWidth
        const y = (rect.top + rect.height / 2) / window.innerHeight

        confetti({
            particleCount: 100,
            spread: 70,
            origin: { x, y },
            colors: ['#006FEE', '#17C964', '#F5A524', '#F31260'],
            gravity: 0.8,
            scalar: 1.2,
        })
    }

    const handleImport = async () => {
        setIsImporting(true)
        triggerConfetti()

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 800))

        setIsImporting(false)
        setShowAnnotation(true)
    }

    return (
        <div className='w-full max-w-2xl mx-auto'>
            {/* Import UI - Always visible */}
            <motion.div layout transition={TRANSITION} className='w-full max-w-xl mx-auto'>
                <Card shadow='none' className='bg-transparent rounded-3xl'>
                    <CardBody className='p-8'>
                        <div className='space-y-6 text-2xl'>
                            {/* URL Input Row */}
                            <div className='flex flex-wrap items-center gap-x-3 gap-y-3 font-semibold'>
                                <span className='text-secondary-400 shrink-0'>
                                    <span className='text-secondary-600'>将</span>
                                    <span className='hidden sm:inline'>网页</span>
                                </span>
                                <label
                                    htmlFor='url'
                                    className='hidden sm:flex text-default-600 items-center gap-1'
                                >
                                    <PiLinkDuotone className='text-4xl' /> 链接
                                </label>
                                <Input
                                    id='url'
                                    type='url'
                                    validationBehavior='aria'
                                    startContent={
                                        <PiLinkDuotone className='text-4xl sm:hidden text-default-600' />
                                    }
                                    value='https://example.com/learn-english'
                                    variant='underlined'
                                    color='primary'
                                    size='lg'
                                    className='flex-1'
                                    classNames={{
                                        innerWrapper: 'pb-0',
                                    }}
                                    readOnly
                                />
                                <span className='text-secondary-400 shrink-0'>
                                    中的文本，<span className='text-secondary-600'>向</span>
                                </span>
                            </div>

                            {/* Library Select Row */}
                            <div className='flex flex-wrap items-center gap-x-3 gap-y-3 font-semibold'>
                                <label
                                    htmlFor='lib'
                                    className='hidden sm:flex text-default-600 items-center gap-1'
                                >
                                    <PiPackageDuotone className='text-4xl' /> 文库
                                </label>
                                <div className='flex-1'>
                                    <Select
                                        id='lib'
                                        selectedKeys={['english-learning']}
                                        variant='underlined'
                                        color='primary'
                                        size='lg'
                                        startContent={
                                            <PiPackageDuotone className='text-4xl sm:hidden text-default-600' />
                                        }
                                        className='w-full'
                                        classNames={{
                                            popoverContent:
                                                'shadow-none border-1 p-3 border-primary-300 bg-secondary-50 rounded-3xl',
                                        }}
                                    >
                                        <SelectItem
                                            key='english-learning'
                                            className='rounded-3xl'
                                            textValue='🇬🇧 My English World'
                                        >
                                            <div className='flex flex-row items-baseline gap-3'>
                                                <span className='truncate font-semibold'>
                                                    {'🇬🇧 My English World'}
                                                </span>
                                                <span className='text-sm text-secondary-400 shrink-0'>
                                                    英语
                                                </span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem
                                            key='japanese-learning'
                                            className='rounded-3xl'
                                            textValue='🇯🇵 Japanese Ebooks'
                                        >
                                            <div className='flex flex-row items-baseline gap-3'>
                                                <span className='truncate font-semibold'>
                                                    {'🇯🇵 Japanese Ebooks'}
                                                </span>
                                                <span className='text-sm text-secondary-400 shrink-0'>
                                                    日语
                                                </span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem
                                            key='chinese-classical'
                                            className='rounded-3xl'
                                            textValue='🇨🇳 文言文库'
                                        >
                                            <div className='flex flex-row items-baseline gap-3'>
                                                <span className='truncate font-semibold'>
                                                    {'🇨🇳 文言文库'}
                                                </span>
                                                <span className='text-sm text-secondary-400 shrink-0'>
                                                    文言文
                                                </span>
                                            </div>
                                        </SelectItem>
                                    </Select>
                                </div>
                                <span className='text-secondary-400 shrink-0'>中</span>

                                <Button
                                    ref={buttonRef}
                                    type='button'
                                    onPress={handleImport}
                                    isLoading={isImporting}
                                    disabled={showAnnotation}
                                    radius='full'
                                    color='primary'
                                    size='lg'
                                    className='font-semibold px-8'
                                    endContent={
                                        isImporting ? (
                                            <PiAirplaneTakeoffDuotone className='size-6' />
                                        ) : streamingComplete ? (
                                            <PiCheckCircleDuotone className='size-6 text-success' />
                                        ) : (
                                            <PiMouseLeftClickDuotone className='size-6 animate-grow' />
                                        )
                                    }
                                >
                                    {isImporting ? '导入中' : showAnnotation ? '已导入' : '导入'}
                                </Button>
                            </div>
                        </div>
                    </CardBody>
                </Card>
            </motion.div>

            {/* Streaming Annotation - Appears below after import */}
            {showAnnotation && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className='w-full'
                >
                    <Card shadow='none' className='bg-default-50 dark:bg-default-100 rounded-3xl'>
                        <CardBody className='p-8'>
                            <StreamingText
                                text={HeroAnnotation}
                                onComplete={handleStreamingComplete}
                            />
                        </CardBody>
                    </Card>
                </motion.div>
            )}

            {/* Animated Learn More Button - Appears after streaming completion */}
            {streamingComplete && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.8, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{
                        duration: 0.6,
                        ease: 'easeOut',
                        delay: 0.5,
                    }}
                    className='mt-4 flex justify-center'
                >
                    <AnimatedLearnMoreButton />
                </motion.div>
            )}
        </div>
    )
}
