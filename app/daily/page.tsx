import Main from '@/components/main'
import H from '@/components/h'
import { Suspense } from 'react'
import Report from './report'
import Bell from './bell'
import { Spacer } from '@nextui-org/spacer'
import { auth } from '@clerk/nextjs/server'
import { getXataClient } from '@/lib/xata'
import { Metadata } from 'next'
import { Skeleton } from '@nextui-org/skeleton'
import Nav from '@/components/nav'

export const metadata: Metadata = {
    title: '日报',
}

export default async function Daily() {
    const xata = getXataClient()
    const hasSubscribed = !!(await xata.db.subs.filter({ uid: auth().userId }).getFirst())

    return (
        <Main className='max-w-screen-md'>
            <Nav></Nav>
            <H>每日报告</H>
            <Spacer y={2}></Spacer>
            <Bell hasSubscribed={hasSubscribed}></Bell>
            <Suspense fallback={<Loading></Loading>}>
                <Report day='今天'></Report>
            </Suspense>
            <Suspense fallback={<Loading></Loading>}>
                <Report day='一天前'></Report>
            </Suspense>
            <Suspense fallback={<Loading></Loading>}>
                <Report day='四天前'></Report>
            </Suspense>
            <Suspense fallback={<Loading></Loading>}>
                <Report day='七天前'></Report>
            </Suspense>
        </Main>
    )
}

const Loading = () => (<div className='my-8 overflow-hidden'>
    <Skeleton className='rounded inline max-w-8'>
        <H disableCenter className='text-xl font-semibold opacity-80 -mb-2'>一天前</H>
    </Skeleton>
    <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 my-5'>
        <div className='w-full h-32 bg-default-200 rounded-lg animate-pulse'></div>
        <div className='w-full h-32 bg-default-200 rounded-lg animate-pulse hidden sm:block'></div>
        <div className='w-full h-32 bg-default-200 rounded-lg animate-pulse hidden md:block'></div>
    </div>
</div>)
