'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { cn } from '@/lib/utils'

const LINES = [
	'「在猫忆的世界里，语言是心灵的纽带」',
	'小白猫爱上了小黑猫。',
	'他想要了解她。他也想被她了解。',
	'但是——他和她语言不通。',
	'你愿意肩负牵起他们之间的心灵连结的重任吗？',
]

export default function StorySection() {
	const containerRef = useRef<HTMLDivElement>(null)

	const { scrollYProgress } = useScroll({
		target: containerRef,
		offset: ['start start', 'end end'],
	})

	return (
		<section ref={containerRef} className='relative' style={{ height: `${LINES.length * 150}vh` }}>
			<div className='sticky top-0 h-screen flex items-center justify-center overflow-hidden'>
				{LINES.map((line, i) => {
					const totalLines = LINES.length
					const segmentStart = i / totalLines
					const segmentEnd = (i + 1) / totalLines
					const fadeFraction = 0.4
					const fadeInEnd = segmentStart + fadeFraction / totalLines
					const fadeOutStart = segmentEnd - fadeFraction / totalLines

					const opacity = useTransform(
						scrollYProgress,
						[segmentStart, fadeInEnd, fadeOutStart, segmentEnd],
						[0, 1, 1, 0],
					)

					const y = useTransform(
						scrollYProgress,
						[segmentStart, fadeInEnd, fadeOutStart, segmentEnd],
						[60, 0, 0, -60],
					)

					const blur = useTransform(
						scrollYProgress,
						[segmentStart, fadeInEnd, fadeOutStart, segmentEnd],
						[8, 0, 0, 8],
					)

					const filter = useTransform(blur, (v) => `blur(${v}px)`)

					const isAccented = i === 0 || i === totalLines - 1

					return (
						<motion.p
							key={i}
							style={{ opacity, y, filter }}
							className={cn(
								'absolute inset-0 flex items-center justify-center text-center px-6 sm:px-12 font-formal font-semibold text-balance',
								'text-4xl sm:text-5xl md:text-6xl lg:text-7xl',
								isAccented
									? 'text-primary-800'
									: 'text-primary-400',
							)}
						>
							{line}
						</motion.p>
					)
				})}
			</div>
		</section>
	)
}
