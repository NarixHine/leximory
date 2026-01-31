'use client'

import { cn } from '@heroui/theme'
import {
    AnimatePresence,
    MotionValue,
    motion,
    useMotionValue,
    useSpring,
    useTransform,
} from 'framer-motion'
import Link from 'next/link'

import { useRef, useState } from 'react'
import { NavIndicator } from '../nav-indicator'

export const Dock = ({
    items,
    className,
}: {
    items: { title: string; icon: React.ReactNode; href: string }[]
    className?: string
}) => {
    const mouseX = useMotionValue(Infinity)
    return (
        <motion.div
            onMouseMove={(e) => mouseX.set(e.pageX)}
            onMouseLeave={() => mouseX.set(Infinity)}
            className={cn(
                'mx-auto h-16 items-end gap-4 rounded-2xl bg-default-50 px-4 pb-3 flex',
                className,
            )}
        >
            {items.map((item) => (
                <IconContainer mouseX={mouseX} key={item.title} {...item} />
            ))}
        </motion.div>
    )
}

function IconContainer({
    mouseX,
    title,
    icon,
    href,
}: {
    mouseX: MotionValue
    title: string
    icon: React.ReactNode
    href: string
}) {
    const ref = useRef<HTMLDivElement>(null)

    const distance = useTransform(mouseX, (val) => {
        const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 }

        return val - bounds.x - bounds.width / 2
    })

    const widthTransform = useTransform(distance, [-150, 0, 150], [40, 80, 40])
    const heightTransform = useTransform(distance, [-150, 0, 150], [40, 80, 40])

    const widthTransformIcon = useTransform(distance, [-150, 0, 150], [20, 40, 20])
    const heightTransformIcon = useTransform(
        distance,
        [-150, 0, 150],
        [20, 40, 20],
    )

    const width = useSpring(widthTransform, {
        mass: 0.1,
        stiffness: 150,
        damping: 12,
    })
    const height = useSpring(heightTransform, {
        mass: 0.1,
        stiffness: 150,
        damping: 12,
    })

    const widthIcon = useSpring(widthTransformIcon, {
        mass: 0.1,
        stiffness: 150,
        damping: 12,
    })
    const heightIcon = useSpring(heightTransformIcon, {
        mass: 0.1,
        stiffness: 150,
        damping: 12,
    })

    const [hovered, setHovered] = useState(false)

    return (
        <Link href={href}>
            <motion.div
                ref={ref}
                style={{ width, height }}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                className='relative flex aspect-square items-center justify-center rounded-full bg-default-100'
            >
                <AnimatePresence>
                    {hovered && (
                        <motion.div
                            initial={{ opacity: 0, y: 10, x: '-50%' }}
                            animate={{ opacity: 1, y: 0, x: '-50%' }}
                            exit={{ opacity: 0, y: 2, x: '-50%' }}
                            className='absolute -top-8 left-1/2 w-fit rounded-md border border-gray-200 bg-default-100 px-2 py-0.5 text-xs whitespace-pre text-neutral-700 dark:border-neutral-900 dark:bg-neutral-800 dark:text-white'
                        >
                            {title}
                        </motion.div>
                    )}
                </AnimatePresence>
                <motion.div
                    style={{ width: widthIcon, height: heightIcon }}
                    className='flex items-center justify-center'
                >
                    <NavIndicator icon={icon} />
                </motion.div>
            </motion.div>
        </Link>
    )
}
