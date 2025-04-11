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
import Link, { useLinkStatus } from 'next/link'
import { ReactNode, useRef } from 'react'
import { isReaderModeAtom } from '../../atoms'
import { Spinner } from '@heroui/spinner'
import { AnimatePresence } from 'framer-motion'

type FloatingDockProps = {
    items: { icon: React.ReactNode; href: string }[]
    className?: string
}

type IconContainerProps = {
    icon: React.ReactNode
    href: string
    styles?: string
}

type IconContainerHorizontalProps = IconContainerProps & {
    mouseX: MotionValue
}

type IconContainerVerticalProps = IconContainerProps & {
    mouseY: MotionValue
}

export const FloatingDock = ({
    items,
    className,
}: FloatingDockProps) => {
    return (
        <>
            <FloatingDockHorizontal items={items} className={className} />
            <FloatingDockVertical items={items} className={className} />
        </>
    )
}
export const FloatingDockHorizontal = ({
    items,
    className,
}: FloatingDockProps) => {
    const mouseX = useMotionValue(Infinity)
    const isReaderMode = useAtomValue(isReaderModeAtom)
    return !isReaderMode && (
        <motion.div
            onMouseMove={(e) => mouseX.set(e.clientX)}
            onMouseLeave={() => mouseX.set(Infinity)}
            className={cn(
                'md:hidden z-50 fixed bottom-2 left-1/2 -translate-x-1/2 flex h-16 gap-4 items-end rounded-2xl backdrop:blur-sm bg-slate-100/60 dark:bg-default-50/90 backdrop-blur-md backdrop-saturate-150 px-4 pb-3',
                className
            )}
        >
            {items.map((item, i) => (
                <IconContainerHorizontal mouseX={mouseX} key={item.href} {...item} styles={['bg-primary-100/60 text-primary-800', 'bg-secondary-100/60 text-secondary-800', 'bg-warning-100/60 text-warning-800', 'bg-danger-100/60 text-danger-800', 'bg-default-200/60 text-default-800'][i]} />
            ))}
        </motion.div>
    )
}

function IconContainerHorizontal({
    mouseX,
    icon,
    href,
    styles,
}: IconContainerHorizontalProps) {
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
                    <Indicator icon={icon} />
                </motion.div>
            </motion.div>
        </Link>
    )
}

export const FloatingDockVertical = ({
    items,
    className,
}: {
    items: { icon: React.ReactNode; href: string }[]
    className?: string
}) => {
    const mouseY = useMotionValue(Infinity)
    const isReaderMode = useAtomValue(isReaderModeAtom)

    return !isReaderMode && (
        <motion.div
            onMouseMove={(e) => mouseY.set(e.clientY)}
            onMouseLeave={() => mouseY.set(Infinity)}
            className={cn(
                'hidden z-50 md:flex fixed right-3 bottom-3 w-16 flex-col gap-4 items-end rounded-2xl backdrop:blur-sm bg-slate-100/60 dark:bg-default-50/90 backdrop-blur-md backdrop-saturate-150 px-3 py-4',
                className
            )}
        >
            {items.map((item, i) => (
                <IconContainerVertical mouseY={mouseY} key={item.href} {...item} styles={['bg-primary-100/60 text-primary-800', 'bg-secondary-100/60 text-secondary-800', 'bg-warning-100/60 text-warning-800', 'bg-danger-100/60 text-danger-800', 'bg-default-200/60 text-default-800'][i]} />
            ))}
        </motion.div>
    )
}

function IconContainerVertical({
    mouseY,
    icon,
    href,
    styles,
}: IconContainerVerticalProps) {
    const ref = useRef<HTMLDivElement>(null)

    const distance = useTransform(mouseY, (val) => {
        const bounds = ref.current?.getBoundingClientRect() ?? { y: 0, height: 0 }
        return val - bounds.y - bounds.height / 2
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
                    <Indicator icon={icon} />
                </motion.div>
            </motion.div>
        </Link>
    )
}

function Indicator({
    icon,
}: {
    icon: ReactNode
}) {
    const { pending } = useLinkStatus()
    const MotionSpinner = motion.create(Spinner)
    return (
        <AnimatePresence mode='wait'>
            {pending ? (
                <MotionSpinner key='spinner' variant='gradient' size='sm' color='white' initial={{ opacity: 0, scale: 0.5 }} transition={{ duration: 0.1 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} />
            ) : (
                <motion.div
                    key='icon'
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={{ duration: 0.1 }}
                >
                    {icon}
                </motion.div>
            )}
        </AnimatePresence>
    )
}

