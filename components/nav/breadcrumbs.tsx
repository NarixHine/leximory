'use client'

import { Breadcrumbs, BreadcrumbItem } from '@heroui/breadcrumbs'
import { Button } from '@heroui/button'
import { PiBookBookmark, PiFileText, PiBooks, PiUserCircle, PiSkipBackCircle } from 'react-icons/pi'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { NavProps } from '.'
import DefaultLoadingIndicatorWrapper from '../ui/loading-indicator-wrapper'
import { ReactNode } from 'react'
import { useAtomValue } from 'jotai'
import { isReaderModeAtom } from '@/app/atoms'
import { cn } from '@/lib/utils'

function LoadingIndicatorWrapper({ children }: { children: ReactNode }) {
    return <DefaultLoadingIndicatorWrapper
        variant='gradient'
        color='current'
        classNames={{
            base: 'size-[18px]',
            wrapper: 'size-[16px]',
            circle1: 'to-primary-900 dark:to-default-500',
            circle2: 'from-primary-900 dark:from-default-500'
        }}>
        {children}
    </DefaultLoadingIndicatorWrapper>
}

interface NavPropsExtended extends NavProps {
    tenant: string
}

export default function NavBreadcrumbs({ lib, text, tenant, isAtCorpus }: NavPropsExtended) {
    const router = useRouter()
    const isReaderMode = useAtomValue(isReaderModeAtom)
    const iconClassName = 'text-stone-700 dark:text-default-500 dark:text-default-500 text-lg'

    return !isReaderMode && <div className='sticky flex justify-center mb-6 -mt-6 z-30 top-4 left-0 w-full space-x-2 print:hidden'>
        <Breadcrumbs underline='hover' variant='solid' radius='full' className='overflow-x-hidden max-w-[95vw]' classNames={{
            list: cn(
                'flex-nowrap',
                'bg-stone-50/40 dark:bg-stone-800/20',
                'border border-stone-300/60 dark:border-stone-600/30',
                'backdrop-blur-lg backdrop-saturate-150',
            ),
        }}>
            {/* Tenant Breadcrumb */}
            <BreadcrumbItem className='max-w-full'>
                <Link href={`/library`} prefetch={false} className='flex items-center gap-1'>
                    <LoadingIndicatorWrapper>
                        <PiUserCircle className={iconClassName} />
                    </LoadingIndicatorWrapper>
                    <span className='inline-block text-ellipsis overflow-hidden whitespace-nowrap max-w-[20vw] md:max-w-[25vw] align-middle text-stone-700 dark:text-default-500'>
                        {tenant}
                    </span>
                </Link>
            </BreadcrumbItem>

            {/* Library Breadcrumb */}
            {lib && (
                <BreadcrumbItem className='max-w-full'>
                    <Link href={`/library/${lib.id}`} prefetch={false} className='flex items-center gap-1'> {/* Wrap content in Link */}
                        <LoadingIndicatorWrapper>
                            <PiBooks className={iconClassName} />
                        </LoadingIndicatorWrapper>
                        <span className='inline-block text-ellipsis overflow-hidden whitespace-nowrap max-w-[20vw] md:max-w-[25vw] align-middle text-stone-700 dark:text-default-500'>
                            {lib.name}
                        </span>
                    </Link>
                </BreadcrumbItem>
            )}

            {/* Corpus Static Breadcrumb */}
            {isAtCorpus && (
                <BreadcrumbItem
                    className='max-w-full text-stone-700 dark:text-default-500'
                    startContent={<PiBookBookmark className={iconClassName} />}
                >
                    语料本
                </BreadcrumbItem>
            )}

            {/* Text Breadcrumb */}
            {text && lib && (
                <BreadcrumbItem className='max-w-full'>
                    <Link href={`/library/${lib.id}/${text.id}`} prefetch={false} className='flex items-center gap-1'> {/* Wrap content in Link */}
                        <LoadingIndicatorWrapper>
                            <PiFileText className={iconClassName} />
                        </LoadingIndicatorWrapper>
                        <span className='inline-block text-ellipsis overflow-hidden whitespace-nowrap max-w-[20vw] md:max-w-[30vw] lg:max-w-[40vw] align-middle text-stone-700 dark:text-default-500'>
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
                    variant='light'
                    onPress={() => {
                        router.back()
                    }}
                    radius='full'
                    isIconOnly
                    className={cn(
                        'bg-stone-50/40 dark:bg-stone-800/20',
                        'border border-stone-300/60 dark:border-stone-600/30',
                        'backdrop-blur-lg backdrop-saturate-150',
                    )}
                    startContent={<PiSkipBackCircle className={iconClassName} />}
                />
                : <Button
                    size='sm'
                    variant='light'
                    href={`/library/${lib.id}/corpus`}
                    as={Link}
                    radius='full'
                    isIconOnly
                    className={cn(
                        'bg-stone-50/40 dark:bg-stone-800/20',
                        'border border-stone-300/60 dark:border-stone-600/30',
                        'backdrop-blur-lg backdrop-saturate-150',
                    )}
                    startContent={<LoadingIndicatorWrapper>
                        <PiBookBookmark className={iconClassName} />
                    </LoadingIndicatorWrapper>}
                />
        )
        }
    </div>
}
