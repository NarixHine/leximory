'use client'

import { cn } from '@/lib/utils'
import { useEffect } from 'react'
import Link from 'next/link'
import { CatchTheBug } from '@/components/catch-the-bug'
import { CHINESE_ZCOOL, ENGLISH_PLAYFAIR } from '@/lib/fonts'
import Center from '@/components/center'
import { PiWarningDiamondDuotone } from 'react-icons/pi'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    return (
        <Center>
            <div className={cn('relative w-full max-w-4xl aspect-video bg-white rounded-2xl shadow-sm overflow-hidden', CHINESE_ZCOOL.className)}>
                {/* Left side: Error icon and minigame */}
                <div className='absolute left-0 top-0 bottom-0 w-1/3 bg-[#B8C5B6] flex flex-col items-center justify-end'>
                    <div className='mb-4 flex flex-col items-center justify-center'>
                        <PiWarningDiamondDuotone className='text-5xl text-white' />
                        <p className={cn('text-xl text-white/90 mb-4', ENGLISH_PLAYFAIR.className)}>
                            ERROR
                        </p>
                    </div>
                    <CatchTheBug />
                </div>

                {/* Right side: Content */}
                <div className='absolute right-0 top-0 bottom-0 w-2/3 flex flex-col items-center justify-center p-8'>
                    <p className='text-3xl text-gray-700 mb-8 font-medium text-center'>
                        出现了一些问题
                    </p>
                    <p className='text-lg text-gray-600 mb-8 text-center'>
                        在此期间，不如尝试捕捉左侧的bug来消磨时间！
                    </p>
                    <div className='flex space-x-4 relative z-10'>
                        <button
                            onClick={reset}
                            className='px-6 py-3 bg-[#B8C5B6] text-white rounded-full font-medium text-lg transition-all duration-300 hover:bg-[#A7B6A4] hover:shadow-sm'
                        >
                            重试
                        </button>
                        <Link
                            href='/'
                            className='px-6 py-3 bg-[#D9E4D7] text-gray-700 rounded-full font-medium text-lg transition-all duration-300 hover:bg-[#C8D6C5] hover:shadow-sm'
                        >
                            首页
                        </Link>
                    </div>
                </div>

                {/* Decorative elements */}
                <div className='absolute top-8 right-8 w-16 h-16 bg-[#D9E4D7] rounded-full opacity-60' />
                <div className='absolute bottom-8 right-24 w-12 h-12 bg-[#D9E4D7] rounded-lg opacity-60' />
                <div className='absolute top-1/3 right-1/3 w-8 h-8 bg-[#D9E4D7] rounded-full opacity-60' />

                {/* Static lines */}
                <svg className='absolute inset-0 w-full h-full' xmlns='http://www.w3.org/2000/svg'>
                    <path
                        d='M 0 50 Q 200 0 400 50 Q 600 100 800 50'
                        stroke='#D9E4D7'
                        strokeWidth='2'
                        fill='none'
                    />
                    <path
                        d='M 0 70 Q 200 120 400 70 Q 600 20 800 70'
                        stroke='#B8C5B6'
                        strokeWidth='2'
                        fill='none'
                    />
                </svg>

                {/* Error details */}
                <div className='absolute bottom-4 left-1/3 right-4 flex flex-col items-end'>
                    {error?.digest && (
                        <span className='text-sm text-gray-500'>
                            错误 ID: {error.digest}
                        </span>
                    )}
                </div>
            </div>
        </Center>
    )
}
