'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

const LINES = [
    '「在猫忆的世界里，语言是心灵的纽带」',
    '小白猫爱上了小黑猫。',
    '他想要了解她。他也想被她了解。',
    '但是——他和她语言不通。',
    '你愿意肩负牵起他们之间的心灵连结的重任吗？',
]

export default function StorySection() {
    return (
        <section className='my-10'>
            {LINES.map((line, i) => {
                const isAccented = i === 0 || i === LINES.length - 1
                return (
                    <div key={i} className='flex items-center justify-center'>
                        <motion.p
                            initial={{ opacity: 0, filter: 'blur(12px)', y: 40 }}
                            whileInView={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
                            viewport={{ once: true, amount: 0.4 }}
                            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                            className={cn(
                                'text-center px-6 sm:px-12 font-formal font-semibold text-balance',
                                i === 0
                                    ? 'text-4xl sm:text-5xl md:text-6xl mb-3'
                                    : 'text-2xl sm:text-3xl md:text-4xl',
                                i === 0 ? 'mb-12' : i === LINES.length - 1 ? 'mt-6' : 'mt-4',
                                isAccented ? 'text-primary-800' : 'text-primary-400',
                            )}
                        >
                            {line}
                        </motion.p>
                    </div>
                )
            })}
        </section>
    )
}
