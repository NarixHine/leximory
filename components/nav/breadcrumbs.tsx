'use client'

import { Breadcrumbs, BreadcrumbItem } from "@heroui/breadcrumbs"
import { Button } from "@heroui/button"
import { PiBookBookmarkDuotone, PiFileTextDuotone, PiBooksDuotone, PiUserCircleDuotone, PiSkipBackCircleDuotone } from 'react-icons/pi'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { NavProps } from '.'
import DefaultLoadingIndicatorWrapper from '../ui/loading-indicator-wrapper'
import { ReactNode, useState } from 'react'
import { AnimatePresence, motion, useMotionValueEvent } from 'framer-motion'
import { useScroll } from 'framer-motion'

function LoadingIndicatorWrapper({ children }: { children: ReactNode }) {
    return <DefaultLoadingIndicatorWrapper
        variant='gradient'
        color='current'
        classNames={{
            base: 'size-[18px]',
            wrapper: 'size-[16px]',
            circle1: 'to-[#67595e] dark:to-default-500',
            circle2: 'from-[#67595e] dark:from-default-500'
        }}>
        {children}
    </DefaultLoadingIndicatorWrapper>
}

interface NavPropsExtended extends NavProps {
    tenant: string
}

export default function NavBreadcrumbs({ lib, text, tenant, isAtCorpus }: NavPropsExtended) {
    const { scrollYProgress } = useScroll()
    const [visible, setVisible] = useState(true)
    useMotionValueEvent(scrollYProgress, "change", (current) => {
        // Check if current is not undefined and is a number
        if (typeof current === "number") {
            if (current < 0.05) {
                setVisible(true)
                return
            }

            const direction = current! - scrollYProgress.getPrevious()!
            if (direction < 0) {
                setVisible(true)
            } else {
                setVisible(false)
            }
        }
    })

    const router = useRouter()
    const iconClassName = 'text-[#67595e] dark:text-default-500 text-lg'

    return <AnimatePresence mode="wait">
        <motion.div
            initial={{ opacity: 1, y: 4 }}
            animate={{ opacity: visible ? 1 : 0, y: visible ? 4 : -100 }}
            transition={{ duration: 0.3 }}
            className='sticky flex justify-center mb-6 -mt-6 z-30 top-4 left-0 w-full space-x-2 print:hidden'
        >
            <Breadcrumbs underline='hover' variant='solid' radius='lg' className='overflow-x-hidden max-w-[95vw]' classNames={{
                list: 'flex-nowrap bg-[#ece1d9]/70 dark:bg-default-200/70 backdrop-blur-sm',
            }}>
                {/* Tenant Breadcrumb */}
                <BreadcrumbItem className='max-w-full'>
                    <Link href={`/library`} prefetch={false} className="flex items-center gap-1">
                        <LoadingIndicatorWrapper>
                            <PiUserCircleDuotone className={iconClassName} />
                        </LoadingIndicatorWrapper>
                        <span className='inline-block text-ellipsis overflow-hidden whitespace-nowrap max-w-[20vw] md:max-w-[25vw] align-middle text-[#67595e] dark:text-default-500'>
                            {tenant}
                        </span>
                    </Link>
                </BreadcrumbItem>

                {/* Library Breadcrumb */}
                {lib && (
                    <BreadcrumbItem className='max-w-full'>
                        <Link href={`/library/${lib.id}`} prefetch={false} className="flex items-center gap-1"> {/* Wrap content in Link */}
                            <LoadingIndicatorWrapper>
                                <PiBooksDuotone className={iconClassName} />
                            </LoadingIndicatorWrapper>
                            <span className='inline-block text-ellipsis overflow-hidden whitespace-nowrap max-w-[20vw] md:max-w-[25vw] align-middle text-[#67595e] dark:text-default-500'>
                                {lib.name}
                            </span>
                        </Link>
                    </BreadcrumbItem>
                )}

                {/* Corpus Static Breadcrumb */}
                {isAtCorpus && (
                    <BreadcrumbItem
                        className='max-w-full text-[#67595e] dark:text-default-500'
                        startContent={<PiBookBookmarkDuotone className={iconClassName} />}
                    >
                        语料本
                    </BreadcrumbItem>
                )}

                {/* Text Breadcrumb */}
                {text && lib && (
                    <BreadcrumbItem className='max-w-full'>
                        <Link href={`/library/${lib.id}/${text.id}`} prefetch={false} className="flex items-center gap-1"> {/* Wrap content in Link */}
                            <LoadingIndicatorWrapper>
                                <PiFileTextDuotone className={iconClassName} />
                            </LoadingIndicatorWrapper>
                            <span className='inline-block text-ellipsis overflow-hidden whitespace-nowrap max-w-[20vw] md:max-w-[30vw] lg:max-w-[40vw] align-middle text-[#67595e] dark:text-default-500'>
                                {text.name}
                            </span>
                        </Link>
                    </BreadcrumbItem>
                )}
            </Breadcrumbs>

            {lib && (
                isAtCorpus
                    ? <Button
                        size='sm'
                        variant='flat'
                        onPress={() => {
                            router.back()
                        }}
                        radius='lg'
                        isIconOnly
                        className='bg-[#e4d4c8]/50 dark:bg-default-200/50 backdrop-blur-sm ml-2'
                        startContent={<PiSkipBackCircleDuotone className='text-[#67595e] dark:text-default-500 text-lg' />}
                    />
                    : <Button
                        size='sm'
                        variant='flat'
                        href={`/library/${lib.id}/corpus`}
                        as={Link}
                        radius='lg'
                        isIconOnly
                        className='bg-[#e4d4c8]/50 dark:bg-default-200/50 backdrop-blur-sm ml-2'
                    >
                        <LoadingIndicatorWrapper>
                            <PiBookBookmarkDuotone className='text-[#67595e] dark:text-default-500 text-medium' />
                        </LoadingIndicatorWrapper>
                    </Button>
            )
            }
        </motion.div>
    </AnimatePresence>
}
