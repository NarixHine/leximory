'use client'

import { Breadcrumbs, BreadcrumbItem } from "@heroui/breadcrumbs"
import { Button } from "@heroui/button"
import { PiBookBookmark, PiFileText, PiBooks, PiUserCircle, PiSkipBackCircle } from 'react-icons/pi'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { NavProps } from '.'
import DefaultLoadingIndicatorWrapper from '../ui/loading-indicator-wrapper'
import { ReactNode } from 'react'
import { useAtomValue } from 'jotai'
import { isReaderModeAtom } from '@/app/atoms'

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
    const iconClassName = 'text-primary-900 dark:text-default-500 text-lg'

    return !isReaderMode && <div className='sticky flex justify-center mb-6 -mt-6 z-30 top-4 left-0 w-full space-x-2 print:hidden'>
        <Breadcrumbs underline='hover' variant='solid' radius='lg' className='overflow-x-hidden max-w-[95vw]' classNames={{
            list: 'flex-nowrap bg-primary-50/50 dark:bg-default-50/70 backdrop-blur-sm',
        }}>
            {/* Tenant Breadcrumb */}
            <BreadcrumbItem className='max-w-full'>
                <Link href={`/library`} prefetch={false} className="flex items-center gap-1">
                    <LoadingIndicatorWrapper>
                        <PiUserCircle className={iconClassName} />
                    </LoadingIndicatorWrapper>
                    <span className='inline-block text-ellipsis overflow-hidden whitespace-nowrap max-w-[20vw] md:max-w-[25vw] align-middle text-primary-900 dark:text-default-500'>
                        {tenant}
                    </span>
                </Link>
            </BreadcrumbItem>

            {/* Library Breadcrumb */}
            {lib && (
                <BreadcrumbItem className='max-w-full'>
                    <Link href={`/library/${lib.id}`} prefetch={false} className="flex items-center gap-1"> {/* Wrap content in Link */}
                        <LoadingIndicatorWrapper>
                            <PiBooks className={iconClassName} />
                        </LoadingIndicatorWrapper>
                        <span className='inline-block text-ellipsis overflow-hidden whitespace-nowrap max-w-[20vw] md:max-w-[25vw] align-middle text-primary-900 dark:text-default-500'>
                            {lib.name}
                        </span>
                    </Link>
                </BreadcrumbItem>
            )}

            {/* Corpus Static Breadcrumb */}
            {isAtCorpus && (
                <BreadcrumbItem
                    className='max-w-full text-primary-900 dark:text-default-500'
                    startContent={<PiBookBookmark className={iconClassName} />}
                >
                    语料本
                </BreadcrumbItem>
            )}

            {/* Text Breadcrumb */}
            {text && lib && (
                <BreadcrumbItem className='max-w-full'>
                    <Link href={`/library/${lib.id}/${text.id}`} prefetch={false} className="flex items-center gap-1"> {/* Wrap content in Link */}
                        <LoadingIndicatorWrapper>
                            <PiFileText className={iconClassName} />
                        </LoadingIndicatorWrapper>
                        <span className='inline-block text-ellipsis overflow-hidden whitespace-nowrap max-w-[20vw] md:max-w-[30vw] lg:max-w-[40vw] align-middle text-primary-900 dark:text-default-500'>
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
                    className='bg-primary-50/50 dark:bg-default-50/50 backdrop-blur-sm ml-2'
                    startContent={<PiSkipBackCircle className='text-primary-900 dark:text-default-500 text-lg' />}
                />
                : <Button
                    size='sm'
                    variant='flat'
                    href={`/library/${lib.id}/corpus`}
                    as={Link}
                    radius='lg'
                    isIconOnly
                    className='bg-primary-50/50 dark:bg-default-50/50 backdrop-blur-sm ml-2'
                >
                    <LoadingIndicatorWrapper>
                        <PiBookBookmark className='text-primary-900 dark:text-default-500 text-medium' />
                    </LoadingIndicatorWrapper>
                </Button>
        )
        }
    </div>
}
