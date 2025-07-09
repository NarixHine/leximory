'use client'

import Image from 'next/image'
import { ENGLISH, ENGLISH_SERIF } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import Markdown from '../markdown'
import { Accordion, AccordionItem, ScrollShadow, Skeleton } from '@heroui/react'
import { momentSH } from '@/lib/moment'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { TimesSummaryData } from './types'
import { fetchIssue, fetchLatestIssue, fetchMoreIssues } from './actions'
import { useIntersectionObserver } from 'usehooks-ts'
import { getRecentTimesData } from '@/server/db/times'
import { Suspense, useEffect } from 'react'
import { prefixUrl, TIMES_PAGE_SIZE } from '@/lib/config'
import { useQueryState } from 'nuqs'
import { Card, CardBody } from '@heroui/card'
import { Spinner } from '@heroui/spinner'
import Define from '../define'
import Paper from '../editory'
import { Spacer } from '@heroui/spacer'
import Link from 'next/link'
import { Divider } from '@heroui/divider'
import { useIsMobile } from '@/lib/hooks'
import { useAtomValue } from 'jotai'
import { isFullScreenAtom } from './atoms'

interface PanelProps {
    recentData: Awaited<ReturnType<typeof getRecentTimesData>>
}

function TimesContentSkeleton() {
    return (
        <article className='m-6 md:px-4 md:my-12 w-screen max-w-[680px] prose-lg prose dark:prose-invert'>
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
                    base: '-mb-8 -mt-10',
                    title: 'text-xl',
                    heading: 'mb-0'
                }}>
                    <div className='space-y-3'>
                        <Skeleton className='h-4 w-full rounded-lg' />
                        <Skeleton className='h-4 w-5/6 rounded-lg' />
                        <Skeleton className='h-4 w-4/6 rounded-lg' />
                        <Skeleton className='h-4 w-3/4 rounded-lg' />
                        <Skeleton className='h-4 w-5/6 rounded-lg' />
                        <Skeleton className='h-4 w-4/6 rounded-lg' />
                        <Skeleton className='h-4 w-3/4 rounded-lg' />
                        <Skeleton className='h-4 w-5/6 rounded-lg' />
                        <Skeleton className='h-4 w-4/6 rounded-lg' />
                        <Skeleton className='h-4 w-3/4 rounded-lg' />
                        <Skeleton className='h-4 w-5/6 rounded-lg' />
                        <Skeleton className='h-4 w-4/6 rounded-lg' />
                        <Skeleton className='h-4 w-3/4 rounded-lg' />
                        <Skeleton className='h-4 w-5/6 rounded-lg' />
                        <Skeleton className='h-4 w-4/6 rounded-lg' />
                        <Skeleton className='h-4 w-3/4 rounded-lg' />
                    </div>
                </AccordionItem>
            </Accordion>

            {/* News Skeleton */}
            <h2 className='mb-8'>Daily News</h2>
            <div className='space-y-3'>
                <Skeleton className='h-4 w-full rounded-lg' />
                <Skeleton className='h-4 w-5/6 rounded-lg' />
                <Skeleton className='h-4 w-4/6 rounded-lg' />
                <Skeleton className='h-4 w-3/4 rounded-lg' />
                <Skeleton className='h-4 w-5/6 rounded-lg' />
                <Skeleton className='h-4 w-full rounded-lg' />
                <Skeleton className='h-4 w-3/4 rounded-lg' />
                <Skeleton className='h-4 w-5/6 rounded-lg' />
                <Skeleton className='h-4 w-3/4 rounded-lg' />
                <Skeleton className='h-4 w-5/6 rounded-lg' />
                <Skeleton className='h-4 w-full rounded-lg' />
                <Skeleton className='h-4 w-3/4 rounded-lg' />
                <Skeleton className='h-4 w-5/6 rounded-lg' />
                <Skeleton className='h-4 w-4/6 rounded-lg' />
                <Skeleton className='h-4 w-3/4 rounded-lg' />
            </div>

            <Spacer y={10} />
        </article>
    )
}

function TimesContent() {
    const isFullScreen = useAtomValue(isFullScreenAtom)
    const [dateInUrl] = useQueryState('date')
    const { data } = useQuery({
        queryKey: ['times', dateInUrl],
        queryFn: () => dateInUrl ? fetchIssue(dateInUrl) : fetchLatestIssue(),
    })

    if (!data) {
        return <TimesContentSkeleton />
    }

    const { cover, news, novel, quiz, date, audio } = data

    return (
        <article className='m-6 md:px-4 md:my-12 max-w-[680px] prose-lg prose dark:prose-invert'>
            {/* Header */}
            <div>
                <h1 className='mb-2 font-semibold'>{momentSH(date).format('LL')}</h1>
                <span className='text-xl text-default-600'>Brought to you with AI by <Link href={'/blog/the-times'} className='underline-offset-[5px] text-inherit decoration-1'>The Leximory Times</Link></span>
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
                        fontFamily={ENGLISH_SERIF.style.fontFamily}
                        md={`${novel} ■`}
                    />
                </AccordionItem>
            </Accordion>

            <h2>Daily News</h2>
            {/* Content */}
            {audio && <div className='-my-4'><audio
                controls
                src={audio}
                className='w-full'
                preload='none'
                onContextMenu={(e) => e.preventDefault()}
            /></div>}
            <p>
                <i>These are the headlines today in <b>Leximory</b>, a small coastal country <b>on Mars</b>.</i>
            </p>
            <Markdown
                className='prose-lg'
                fontFamily={ENGLISH_SERIF.style.fontFamily}
                md={news}
            />

            {quiz && <>
                <h2 className='mb-3'>Daily Quiz</h2>
                {/* Quiz */}
                <i>This quiz is based on the news published three days ago. {['cloze', 'fishing'].includes(quiz.type) && <i>Click on the blanks to show options.</i>}</i>
                <Card shadow='none' className='bg-transparent -mt-6'>
                    <CardBody className='p-6'>
                        <Paper data={[quiz]} className='border-l-1.5 border-foreground -ml-4 pl-4' accordianItemClassName='bg-default-50/50' />
                    </CardBody>
                </Card>
            </>}

            {/* Divider & Footer */}
            <div className='flex gap-3 justify-center items-center -my-8'>
                <Divider className='flex-1' />
                <div className='text-default-500 italic'>The End</div>
                <Divider className='flex-1' />
            </div>

            <footer className={cn('text-sm text-default-500 text-center', isFullScreen ? 'pb-6' : 'pb-20 md:pb-6')}>
                <i>An Experimental Publication by <Link href={prefixUrl('/')} className='underline-offset-4 text-inherit'>Leximory</Link></i>
            </footer>
        </article>
    )
}

function TimesDateCard({ date, cover }: { date: string, cover: string }) {
    const [, setDateQuery] = useQueryState('date')

    return (
        <Card
            className={cn(
                'relative flex-shrink-0 w-40 md:w-full h-20 md:h-auto aspect-square cursor-pointer transition-transform duration-200 rounded-2xl overflow-hidden group',
                ENGLISH.className
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
                    <div className='text-3xl md:text-5xl'>{momentSH(date).format('DD')}</div>
                    <div className='opacity-90'>{momentSH(date).format('YYYY MMM')}</div>
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

    const isMobile = useIsMobile()
    return (
        <ScrollShadow hideScrollBar orientation={isMobile ? 'horizontal' : 'vertical'} size={15} className='flex md:h-full md:min-w-64 md:flex-col md:overflow-y-auto overflow-x-auto'>
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
                            <div ref={ref} className='h-20 md:h-4 w-full flex items-center justify-center'>
                                <Spinner variant='dots' color='default' />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </ScrollShadow>
    )
}

export default function Panel({ recentData }: PanelProps) {
    const isMobile = useIsMobile()
    return (
        <div className={cn('w-full h-full shadow-sm rounded-2xl overflow-hidden', ENGLISH_SERIF.className)}>
            {/* Main Paper Container */}
            <div className='w-full h-full flex flex-col justify-center md:flex-row bg-white dark:bg-neutral-900'>
                <TimesSidebar
                    data={recentData}
                />

                <ScrollShadow size={20} isEnabled={isMobile} className='flex h-full overflow-y-auto overflow-x-hidden'>
                    {/* Main Content */}
                    <Suspense fallback={<TimesContentSkeleton />}>
                        <TimesContent />
                    </Suspense>
                </ScrollShadow>
            </div>

            <Define />
        </div>
    )
}
