import Main from '@/components/main'
import H from '@/components/h'
import { Suspense } from 'react'
import Report from './report'
import Bell from './bell'
import { Spacer, Skeleton } from '@nextui-org/react'
import { auth } from '@clerk/nextjs/server'
import { getXataClient } from '@/lib/xata'
import { Metadata } from 'next'
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
            <Spacer y={6}></Spacer>
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
    <Skeleton className='w-20 rounded-lg h-7'></Skeleton>
    <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 my-5'>
        <Skeleton className='w-full h-32 rounded-lg'></Skeleton>
        <Skeleton className='w-full h-32 rounded-lg hidden sm:block'></Skeleton>
        <Skeleton className='w-full h-32 rounded-lg hidden md:block'></Skeleton>
    </div>
</div>)
