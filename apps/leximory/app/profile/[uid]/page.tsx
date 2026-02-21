import Center from '@/components/ui/center'
import H from '@/components/ui/h'
import { Suspense } from 'react'
import PublicLibraries from './components/public-libraries'
import UserInfo from './components/user-info'
import WordStatsSection from './components/word-stats'
import { UserPublicFeed } from '@/app/memories/components/user-public-feed'
import { Spacer } from '@heroui/spacer'
import { LibrarySkeleton } from '@/app/library/components/lib'

type ProfilePageProps = {
    params: Promise<{
        uid: string
    }>
}

export default function ProfilePage({ params }: ProfilePageProps) {
    return (
        <Suspense>
            <ProfilePageContent params={params} />
        </Suspense>
    )
}

async function ProfilePageContent({ params }: ProfilePageProps) {
    const uid = (await params).uid
    return <Center className='flex-col max-w-(--breakpoint-xl) gap-4'>
        <UserInfo uid={uid} />
        <div className='flex flex-col md:flex-row gap-12 w-full mt-3'>
            <WordStatsSection uid={uid} />
            <div className='basis-full md:basis-3/5'>
                <H className='text-2xl font-semibold mb-4'>公开文库</H>
                <Suspense fallback={
                    <div className='columns-1 lg:columns-2 gap-4 space-y-4'>
                        {[...Array(3)].map((_, i) => (
                            <LibrarySkeleton key={i} />
                        ))}
                    </div>
                }>
                    <PublicLibraries uid={uid} />
                </Suspense>
                <Spacer y={10} />
                <UserPublicFeed userId={uid} />
            </div>
        </div>
    </Center>
}
