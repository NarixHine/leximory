import Center from '@/components/ui/center'
import H from '@/components/ui/h'
import { Suspense } from 'react'
import PublicLibraries from './components/public-libraries'
import { LibraryCardSkeleton } from '@/app/marketplace/[page]/components/card'
import UserInfo from './components/user-info'
import WordStatsSection from './components/word-stats'

export default async function ProfilePage({ params }: { params: Promise<{ uid: string }> }) {
    const uid = (await params).uid
    return <Center className='flex-col max-w-screen-xl gap-4'>
        <UserInfo uid={uid} />
        <div className='flex flex-col md:flex-row gap-4 md:gap-12'>
            <WordStatsSection uid={uid} />
            <Suspense fallback={
                <div className='basis-3/5'>
                    <H className='text-xl mb-4'>公开文库</H>
                    <div className='grid grid-cols-1 gap-5 lg:grid-cols-2'>
                        {[...Array(2)].map((_, i) => (
                            <LibraryCardSkeleton key={i} />
                        ))}
                    </div>
                </div>
            }>
                <PublicLibraries uid={uid} />
            </Suspense>
        </div>
    </Center>
}
