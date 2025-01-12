'use client'

import { cn } from '@/lib/utils'
import {
    MotionValue,
    motion,
    useMotionValue,
    useSpring,
    useTransform,
} from 'framer-motion'
import { useAtomValue } from 'jotai'
import Link from 'next/link'
import { useRef } from 'react'
import { isReaderModeAtom } from '../../atoms'

export const FloatingDock = ({
    items,
    className,
}: {
    items: { icon: React.ReactNode; href: string }[]
    className?: string
}) => {
    const mouseX = useMotionValue(Infinity)
    const isReaderMode = useAtomValue(isReaderModeAtom)
    return !isReaderMode && (
        <motion.div
            onMouseMove={(e) => mouseX.set(e.pageX)}
            onMouseLeave={() => mouseX.set(Infinity)}
            className={cn(
                'fixed bottom-0 left-1/2 -translate-x-1/2 flex h-16 gap-4 items-end rounded-tl-2xl rounded-tr-2xl backdrop:blur-sm border border-default-100/80 backdrop-blur-md backdrop-saturate-150 px-4 pb-3',
                className
            )}
        >
            {items.map((item, i) => (
                <IconContainer mouseX={mouseX} key={item.href} {...item} styles={['bg-primary-100/50 text-primary-800', 'bg-secondary-100/50 text-secondary-800', 'bg-warning-100/50 text-warning-800', 'bg-danger-100/50 text-danger-800', 'bg-default-100/50 text-default-800'][i]} />
            ))}
        </motion.div>
    )
}

function IconContainer({
    mouseX,
    icon,
    href,
    styles,
}: {
    mouseX: MotionValue
    icon: React.ReactNode
    href: string
    styles?: string
}) {
    const ref = useRef<HTMLDivElement>(null)

    const distance = useTransform(mouseX, (val) => {
        const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 }

        return val - bounds.x - bounds.width / 2
    })

    const widthTransform = useTransform(distance, [-150, 0, 150], [40, 80, 40])
    const heightTransform = useTransform(distance, [-150, 0, 150], [40, 80, 40])

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

    const opacity = useTransform(distance, [-100, 0, 100], [0.9, 1, 0.9])

    const iconScale = useTransform(distance, [-150, 0, 150], [1.3, 2.3, 1.3])
    const iconSpring = useSpring(iconScale, {
        mass: 0.1,
        stiffness: 150,
        damping: 12,
    })

    return (
        <Link href={href}>
            <motion.div
                ref={ref}
                style={{ width, height, opacity }}
                className={cn(
                    'aspect-square rounded-full flex items-center justify-center relative',
                    styles
                )}
            >
                <motion.div
                    style={{ scale: iconSpring }}
                    className="flex items-center justify-center"
                >
                    {icon}
                </motion.div>
            </motion.div>
        </Link>
    )
}
