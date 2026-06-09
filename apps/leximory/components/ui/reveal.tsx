'use client'

import { motion, useInView, type Transition, type MarginType } from 'framer-motion'
import { useRef, type ReactNode } from 'react'

const directions = {
	up: { y: 24 },
	down: { y: -24 },
	left: { x: 24 },
	right: { x: -24 },
	none: {},
} as const

type Direction = keyof typeof directions

const defaultTransition: Transition = {
	duration: 0.55,
	ease: [0.22, 1, 0.36, 1],
}

export function Reveal({
	children,
	direction = 'up',
	delay = 0,
	transition,
	className,
	once = true,
	margin = '-64px',
}: {
	children: ReactNode
	direction?: Direction
	delay?: number
	transition?: Transition
	className?: string
	once?: boolean
	margin?: MarginType
}) {
	const ref = useRef<HTMLDivElement>(null)
	const inView = useInView(ref, { once, margin })

	return (
		<motion.div
			ref={ref}
			initial={{ opacity: 0, ...directions[direction] }}
			animate={
				inView
					? { opacity: 1, x: 0, y: 0 }
					: { opacity: 0, ...directions[direction] }
			}
			transition={{ ...defaultTransition, delay, ...transition }}
			className={className}
		>
			{children}
		</motion.div>
	)
}
