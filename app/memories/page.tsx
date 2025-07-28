import { CreateMemoryForm } from './components/create-memory-form'
import { PersonalFeed } from './components/personal-feed'
import { FederatedFeed } from './components/federated-feed'
import { Suspense } from 'react'
import { FeedSkeleton } from './components/feed-skeleton'
import { MemoryTabs } from './components/memory-tabs'
import Main from '@/components/ui/main'
import H from '@/components/ui/h'

export default function MemoriesPage() {
    return (
        <Main className='max-w-screen-lg mx-auto flex flex-col gap-8'>
            <H fancy>Memories</H>
            <div className='flex flex-col md:flex-row gap-8'>
                <section className='md:basis-1/3'>
                    <CreateMemoryForm />
                </section>
                <section className='md:basis-2/3 w-full md:w-fit justify-center flex md:block'>
                    <MemoryTabs
                        personalFeed={
                            <Suspense fallback={<FeedSkeleton />}>
                                <PersonalFeed />
                            </Suspense>
                        }
                        federatedFeed={
                            <Suspense fallback={<FeedSkeleton />}>
                                <FederatedFeed />
                            </Suspense>
                        }
                    />
                </section>
            </div>
        </Main>
    )
}