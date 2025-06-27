'use client'

import Image from 'next/image'
import { ENGLISH_MODERN } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import Markdown from '../markdown'
import { Accordion, AccordionItem, Skeleton } from '@heroui/react'
import moment from 'moment-timezone'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { TimesSummaryData } from './types'
import { fetchIssue, fetchLatestIssue, fetchMoreIssues } from './actions'
import { useIntersectionObserver } from 'usehooks-ts'
import { getRecentTimesData } from '@/server/db/times'
import { Suspense, useEffect } from 'react'
import { TIMES_PAGE_SIZE } from '@/lib/config'
import { useQueryState } from 'nuqs'
import { Card, CardBody } from '@heroui/card'
import { Spinner } from '@heroui/spinner'
import Define from '../define'
import Paper from '../editory/paper'
import { Spacer } from '@heroui/spacer'

interface PanelProps {
    recentData: Awaited<ReturnType<typeof getRecentTimesData>>
}

function TimesContentSkeleton() {
    return (
        <article className='m-6 md:px-4 md:my-12 w-screen max-w-screen-md prose-lg prose dark:prose-invert'>
            {/* Header Skeleton */}
            <div className='flex flex-col gap-4 w-full'>
                <Skeleton className='h-8 w-full rounded-lg' />
                <Skeleton className='h-6 w-full rounded-lg' />
            </div>

            {/* Cover Image Skeleton */}
            <div className='relative w-full aspect-video rounded-2xl overflow-hidden mb-5 mt-4'>
                <Skeleton className='absolute inset-0' />
            </div>

            {/* Novel Skeleton */}
            <Accordion className='mt-4'>
                <AccordionItem title='Daily Novel' classNames={{
                    base: '-mb-2 -mt-10',
                    title: 'text-xl',
                    heading: 'mb-0'
                }}>
                    <div className='space-y-3'>
                        <Skeleton className='h-4 w-full rounded-lg' />
                        <Skeleton className='h-4 w-5/6 rounded-lg' />
                        <Skeleton className='h-4 w-4/6 rounded-lg' />
                        <Skeleton className='h-4 w-3/4 rounded-lg' />
                        <Skeleton className='h-4 w-5/6 rounded-lg' />
                    </div>
                </AccordionItem>
            </Accordion>

            {/* News Skeleton */}
            <h2 className='mt-4 mb-6'>Daily News</h2>
            <div className='space-y-3 mt-4'>
                <Skeleton className='h-4 w-full rounded-lg' />
                <Skeleton className='h-4 w-5/6 rounded-lg' />
                <Skeleton className='h-4 w-4/6 rounded-lg' />
                <Skeleton className='h-4 w-3/4 rounded-lg' />
                <Skeleton className='h-4 w-5/6 rounded-lg' />
                <Skeleton className='h-4 w-4/6 rounded-lg' />
                <Skeleton className='h-4 w-3/4 rounded-lg' />
                <Skeleton className='h-4 w-5/6 rounded-lg' />
            </div>
        </article>
    )
}

function TimesContent() {
    const [date] = useQueryState('date')
    const { data } = useQuery({
        queryKey: ['times', date],
        queryFn: () => date ? fetchIssue(date) : fetchLatestIssue(),
    })

    if (!data) {
        return <TimesContentSkeleton />
    }

    const { cover, news, novel, quiz } = data

    return (
        <article className='m-6 md:px-4 md:my-12 prose-lg prose dark:prose-invert'>
            {/* Header */}
            <div>
                <h1 className='mb-2 font-semibold'>{moment(date).format('LL')}</h1>
                <span className='text-xl opacity-80'>Brought to you with AI by <span className='font-semibold'>The Leximory Times</span></span>
            </div>

            {/* Cover Image */}
            <div className='relative w-full aspect-video rounded-2xl overflow-hidden mb-5'>
                <Image src={cover} alt='Daily cover' fill sizes='600px' className='object-cover object-center rounded-2xl' />
            </div>
            <Accordion>
                <AccordionItem title='Daily Novel' classNames={{
                    base: '-mb-8 -mt-10',
                    title: 'text-xl',
                    heading: 'mb-0'
                }}>
                    <Markdown
                        className='prose-lg'
                        fontFamily={ENGLISH_MODERN.style.fontFamily}
                        md={`${novel} ■`}
                    />
                </AccordionItem>
            </Accordion>

            <h2>Daily News</h2>
            {/* Content */}
            <Markdown
                className='prose-lg'
                fontFamily={ENGLISH_MODERN.style.fontFamily}
                md={news}
            />

            {quiz ? <>
                <h2>Daily Quiz</h2>
                {/* Quiz */}
                <i>This quiz is based on the news published three days ago. Click on the blank to show options.</i>
                <Card shadow='none' className='bg-white' isBlurred>
                    <CardBody className='p-6'>
                        <Paper data={[quiz]} accordianClassName='-mt-4' accordianItemClassName='bg-secondary-50/50' />
                    </CardBody>
                </Card>
            </> : <Spacer y={10} />}
        </article>
    )
}

function TimesDateCard({ date, cover }: { date: string, cover: string }) {
    const [, setDateQuery] = useQueryState('date')

    return (
        <Card
            className={cn(
                'relative flex-shrink-0 w-40 md:w-full h-20 md:h-auto aspect-square cursor-pointer transition-transform duration-200 rounded-2xl overflow-hidden group'
            )}
            isPressable
            onPress={() => setDateQuery(date)}
        >
            <CardBody
                className='relative flex-shrink-0 w-40 md:w-full h-20 md:h-auto aspect-square cursor-pointer hover:scale-105 transition-transform duration-200 rounded-2xl overflow-hidden group'
            >
                <Image
                    src={cover}
                    alt='Date background'
                    fill
                    sizes='200px'
                    className='absolute object-cover opacity-90 group-hover:opacity-100 transition-opacity'
                />
                <div className='absolute inset-0 bg-black/20' />
                <div className='absolute inset-0 flex flex-col items-center justify-center text-white'>
                    <div className='text-3xl md:text-5xl'>{moment(date).format('DD')}</div>
                    <div className='opacity-90'>{moment(date).format('YYYY MMM')}</div>
                </div>
            </CardBody>
        </Card>
    )
}

function TimesDateCardSkeleton() {
    return (
        <Card
            className={cn(
                'relative flex-shrink-0 w-40 md:w-full h-20 md:h-auto aspect-square cursor-pointer transition-transform duration-200 rounded-2xl overflow-hidden group'
            )}
        >
            <CardBody
                className='relative flex-shrink-0 w-40 md:w-full h-20 md:h-auto aspect-square cursor-pointer hover:scale-105 transition-transform duration-200 rounded-2xl overflow-hidden group'
            >
                <Skeleton className='absolute inset-0' />
            </CardBody>
        </Card>
    )
}

function TimesSidebar({ data: initialData }: { data: Awaited<ReturnType<typeof getRecentTimesData>> }) {
    const { isIntersecting, ref } = useIntersectionObserver({
        threshold: 0.1
    })

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useInfiniteQuery({
        queryKey: ['times'],
        queryFn: ({ pageParam = 1 }) => fetchMoreIssues(pageParam),
        getNextPageParam: (lastPage) =>
            lastPage.hasMore ? lastPage.data.length / TIMES_PAGE_SIZE + 1 : undefined,
        initialPageParam: 1,
        initialData: {
            pages: [initialData],
            pageParams: [1]
        }
    })

    useEffect(() => {
        if (isIntersecting && hasNextPage && !isFetchingNextPage) {
            fetchNextPage()
        }
    }, [isIntersecting, hasNextPage, isFetchingNextPage, fetchNextPage])

    return (
        <div className='flex md:h-full md:min-w-64 md:flex-col md:overflow-y-auto overflow-x-auto'>
            <div className='flex flex-row md:flex-col md:static inset-y-0 left-0 z-40'>
                <div className='p-6 md:ml-6'>
                    <div className='flex flex-row md:flex-col space-x-4 md:space-x-0 md:space-y-3'>
                        {data?.pages.map((page) =>
                            page.data.map(({ date, cover }: TimesSummaryData) => (
                                <Suspense fallback={<TimesDateCardSkeleton />} key={date}>
                                    <TimesDateCard date={date} cover={cover} />
                                </Suspense>
                            ))
                        )}
                        {hasNextPage && (
                            <div ref={ref} className='h-4 w-full flex items-center justify-center'>
                                <Spinner variant='dots' />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function Panel({ recentData }: PanelProps) {
    return (
        <div className={cn('w-full h-full shadow-sm rounded-2xl overflow-hidden', ENGLISH_MODERN.className)}>
            {/* Main Paper Container */}
            <div className='w-full h-full flex flex-col justify-center md:flex-row bg-white dark:bg-neutral-900'>
                <TimesSidebar
                    data={recentData}
                />

                <div className='flex h-full overflow-y-auto overflow-x-hidden'>
                    {/* Main Content */}
                    <Suspense fallback={<TimesContentSkeleton />}>
                        <TimesContent />
                    </Suspense>
                </div>
            </div>

            <Define />
        </div>
    )
}
