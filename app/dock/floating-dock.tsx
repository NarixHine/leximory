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
import { useRef, useState } from 'react'
import { isReaderModeAtom } from '../atoms'

export const FloatingDock = ({
    items,
    className,
}: {
    items: { icon: React.ReactNode; href: string }[]
    className?: string
}) => {
    let mouseX = useMotionValue(Infinity)
    const isReaderMode = useAtomValue(isReaderModeAtom)
    return !isReaderMode && (
        <motion.div
            onMouseMove={(e) => mouseX.set(e.pageX)}
            onMouseLeave={() => mouseX.set(Infinity)}
            className={cn(
                'fixed bottom-0 left-1/2 -translate-x-1/2 flex h-16 gap-4 items-end rounded-tl-2xl rounded-tr-2xl bg-danger-100/90 dark:bg-primary-100/50 backdrop-blur-md backdrop-saturate-150 px-4 pb-3',
                className
            )}
        >
            {items.map((item, i) => (
                <IconContainer mouseX={mouseX} key={item.href} {...item} styles={i === 0 ? 'bg-warning-300' : i === 1 ? 'bg-primary-300' : i === 2 ? 'bg-secondary-400' : 'bg-danger-200'} />
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
    let ref = useRef<HTMLDivElement>(null)

    let distance = useTransform(mouseX, (val) => {
        let bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 }

        return val - bounds.x - bounds.width / 2
    })

    let widthTransform = useTransform(distance, [-150, 0, 150], [40, 80, 40])
    let heightTransform = useTransform(distance, [-150, 0, 150], [40, 80, 40])

    let widthTransformIcon = useTransform(distance, [-150, 0, 150], [20, 40, 20])
    let heightTransformIcon = useTransform(
        distance,
        [-150, 0, 150],
        [20, 40, 20]
    )

    let width = useSpring(widthTransform, {
        mass: 0.1,
        stiffness: 150,
        damping: 12,
    })
    let height = useSpring(heightTransform, {
        mass: 0.1,
        stiffness: 150,
        damping: 12,
    })

    let widthIcon = useSpring(widthTransformIcon, {
        mass: 0.1,
        stiffness: 150,
        damping: 12,
    })
    let heightIcon = useSpring(heightTransformIcon, {
        mass: 0.1,
        stiffness: 150,
        damping: 12,
    })

    let opacity = useTransform(distance, [-100, 0, 100], [0.9, 1, 0.9])

    const [hovered, setHovered] = useState(false)

    return (
        <Link href={href}>
            <motion.div
                ref={ref}
                style={{ width, height, opacity }}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                className={cn('aspect-square rounded-full flex items-center justify-center relative', styles)}
            >
                <motion.div
                    style={{ width: widthIcon, height: heightIcon }}
                    className='flex items-center justify-center text-primary-800'
                >
                    {icon}
                </motion.div>
            </motion.div>
        </Link>
    )
}
