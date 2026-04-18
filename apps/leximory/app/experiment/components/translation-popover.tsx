'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@heroui/button'
import { Card, CardBody } from '@heroui/card'
import { PiArrowUp, PiCheck } from 'react-icons/pi'

interface TranslationExerciseProps {
    isOpen: boolean
    onClose: () => void
    data?: {
        chinese: string
        answer: string
        keyword: string
    }
}

export function TranslationExercise({ isOpen, onClose, data }: TranslationExerciseProps) {
    const [answer, setAnswer] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSubmitted, setIsSubmitted] = useState(false)

    const handleSubmit = async () => {
        if (!answer.trim()) return

        setIsSubmitting(true)
        await new Promise(resolve => setTimeout(resolve, 1500))
        setIsSubmitting(false)
        setIsSubmitted(true)
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Floating prompt card */}
                    <motion.div
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        className='fixed top-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4'
                    >
                        <Card shadow='none' className='bg-default-50 p-2 shadow-none border-7 border-default-200 rounded-4xl'>
                            <CardBody>
                                {!isSubmitted ? (
                                    <div className='space-y-2'>
                                        <p className='text-xs text-default-400 uppercase tracking-wide font-mono'>Translation</p>
                                        <p className='text-base text-default-800 leading-relaxed'>
                                            {data?.chinese || 'Loading...'}<span className='font-formal'>({data?.keyword})</span>
                                        </p>
                                    </div>
                                ) : (
                                    <div className='text-center py-4'>
                                        <div className='w-8 h-8 mx-auto mb-2 bg-default-100 rounded-full flex items-center justify-center'>
                                            <PiCheck className='w-4 h-4 text-default-600' />
                                        </div>
                                        <p className='text-sm text-default-600'>已提交</p>
                                    </div>
                                )}
                            </CardBody>
                        </Card>
                    </motion.div>

                    {/* Bottom minimal textarea - NO underline */}
                    {!isSubmitted && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                            className='fixed bottom-6 left-0 right-0 z-50 px-4'
                        >
                            <div className='max-w-2xl mx-auto'>
                                <div className='bg-primary-50 rounded-3xl border border-default-200 p-3 pt-2'>
                                    <textarea
                                        value={answer}
                                        onChange={(e) => setAnswer(e.target.value)}
                                        className='w-full px-3 py-2 text-default-700 placeholder:text-default-400 resize-none focus:outline-none bg-transparent border-0'
                                        rows={1}
                                        disabled={isSubmitting}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault()
                                                handleSubmit()
                                            }
                                        }}
                                    />
                                    <div className='flex justify-end mt-2 pt-2'>
                                        <Button
                                            isIconOnly
                                            color='primary'
                                            radius='full'
                                            size='sm'
                                            onPress={handleSubmit}
                                            isLoading={isSubmitting}
                                        >
                                            <PiArrowUp className='w-4 h-4' />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </>
            )}
        </AnimatePresence>
    )
}
