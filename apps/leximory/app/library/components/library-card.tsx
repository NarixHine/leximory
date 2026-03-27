'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { QRCodeSVG } from 'qrcode.react'
import { Lang } from '@repo/schema/library'
import { prefixUrl } from '@repo/env/config'

interface LibraryCardProps {
    isOpen: boolean
    onClose: () => void
    libName: string
    creatorName: string
    lang: Lang
    libId: string
}

export function LibraryCard({ isOpen, onClose, libName, creatorName, libId }: LibraryCardProps) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => { setMounted(true) }, [])
    useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = '' }
    }, [isOpen])

    if (!mounted) return null

    const libUrl = prefixUrl(`/library/${libId}`)

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className='fixed inset-0 z-50 bg-default-200/50 backdrop-blur-lg'
                        onClick={onClose}
                    />

                    <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className='relative w-95 h-145'
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className='relative w-full h-full overflow-hidden rounded-2xl shadow-2xl bg-black/80 border border-white/50'>
                                <Image src='/images/card.webp' alt='' fill className='object-cover opacity-65' priority />

                                <div className='relative h-full flex flex-col p-8 z-10'>
                                    {/* Top: Creator Info */}
                                    <div className='mb-6'>
                                        <h2 className='font-fancy text-6xl tracking-tight text-white drop-shadow-md leading-tight -mb-2'>
                                            {creatorName}
                                        </h2>
                                        <p className='text-2xl text-balance font-sans tracking-tight font-semibold leading-tight text-shadow-lg mt-1'>
                                            <span className='text-white/65'>is <span className='text-white/85'>learning English</span> with this <span className='text-white/85'>Leximory Library</span>.</span>
                                        </p>
                                    </div>

                                    {/* Middle: Graphics */}
                                    <div className='space-y-6'>
                                    </div>

                                    <div className='flex-1' />

                                    {/* Bottom: The Sync Block */}
                                    {/* We use a grid to ensure the QR (first col) matches the Title (second col) height perfectly */}
                                    <div className='grid grid-cols-[0fr_1fr] gap-4 items-center w-full'>
                                        <div className='h-full aspect-square flex items-center justify-start'>
                                            <QRCodeSVG
                                                value={libUrl}
                                                style={{ width: '100%', height: '100%' }}
                                                bgColor='transparent'
                                                fgColor='#FFFFFF'
                                                level='L'
                                            />
                                        </div>
                                        <div className='flex justify-end w-full'>
                                            <h1 className='font-fancy leading-9 tracking-tight text-balance text-right text-4xl text-white'>
                                                {libName}
                                            </h1>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={onClose}
                                className='absolute -bottom-15 left-1/2 -translate-x-1/2 text-foreground/50 hover:text-foreground text-medium font-mono tracking-wide uppercase transition-all'
                            >
                                [ Dismiss ]
                            </button>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    )
}
