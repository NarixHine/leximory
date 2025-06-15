'use client'

import Image from 'next/image'
import { ENGLISH_MODERN } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import Markdown from '../markdown'
import { Accordion, AccordionItem, Skeleton } from '@heroui/react'
import moment from 'moment'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Suspense } from 'react'
import { useQueryState } from 'nuqs'
import { TimesSummaryData } from './types'
import { fetchIssue } from './actions'

interface PanelProps {
    recentData: TimesSummaryData[]
}

function TimesContentSkeleton() {
    return (
        <article className='m-6 md:px-4 md:my-12 w-screen max-w-screen-md'>
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
                    base: 'not-prose -mb-4',
                    title: 'text-xl',
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
            <h3 className='mt-4'>Daily News</h3>
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

function TimesContent({ date }: { date: string }) {
    const { data } = useSuspenseQuery({
        queryKey: ['times', date],
        queryFn: () => fetchIssue(date)
    })

    return (
        <article className='m-6 md:px-4 md:my-12 prose-lg prose'>
            {/* Header */}
            <div>
                <h1 className='mb-2 font-semibold'>{moment(data.date).format('MMMM D, YYYY')}</h1>
                <span className='text-xl opacity-80'>Brought to you with AI by The Leximory Times</span>
            </div>

            {/* Cover Image */}
            <div className='relative w-full aspect-video rounded-2xl overflow-hidden mb-5'>
                <Image src={data.cover} alt='Daily cover' fill sizes='600px' className='object-cover object-center rounded-2xl' />
            </div>
            <Accordion>
                <AccordionItem title='Daily Novel' classNames={{
                    base: '-mb-4 -mt-10',
                    title: 'text-xl',
                    titleWrapper: 'not-prose'
                }}>
                    <Markdown
                        className='prose-lg'
                        fontFamily={ENGLISH_MODERN.style.fontFamily}
                        md={`${data.novel} ■`}
                    />
                </AccordionItem>
            </Accordion>

            <h3>Daily News</h3>
            {/* Content */}
            <Markdown
                className='prose-lg pb-10'
                fontFamily={ENGLISH_MODERN.style.fontFamily}
                md={data.news}
            />
        </article>
    )
}

export default function Panel({ recentData }: PanelProps) {
    const [date, setDate] = useQueryState('date')

    const handleDateClick = (date: string) => {
        setDate(date)
    }

    return (
        <div className={cn('h-dvh w-dvw p-4', ENGLISH_MODERN.className)}>
            {/* Main Paper Container */}
            <div className='w-full h-full flex flex-col md:flex-row bg-white rounded-3xl'>
                <div className='flex md:h-full md:min-w-60 md:flex-col md:overflow-y-auto overflow-x-auto'>
                    {/* Sidebar */}
                    <div className='flex flex-row md:flex-col md:static inset-y-0 left-0 z-40 bg-white'>
                        <div className='p-6'>
                            <div className='flex flex-row md:flex-col space-x-4 md:space-x-0 md:space-y-3'>
                                {recentData.map(({ date, cover }) => (
                                    <div
                                        key={date}
                                        onClick={() => handleDateClick(date)}
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
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className='flex h-full overflow-y-auto overflow-x-hidden'>
                    {/* Main Content */}
                    <Suspense fallback={<TimesContentSkeleton />}>
                        <TimesContent date={date ?? recentData[0].date} />
                    </Suspense>
                </div>
            </div>
        </div>
    )
}
