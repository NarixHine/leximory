import { CreateMemoryForm } from './components/create-memory-form'
import { PersonalFeed } from './components/personal-feed'
import { FederatedFeed } from './components/federated-feed'
import { MemoryTabs } from './components/memory-tabs'
import Main from '@/components/ui/main'
import H from '@/components/ui/h'
import { cn } from '@/lib/utils'
import { contentFontFamily, ENGLISH_FANCY } from '@/lib/fonts'
import { Metadata } from 'next'
import { Spacer } from '@heroui/spacer'

export const metadata: Metadata = { title: 'Memories' }

export default function MemoriesPage() {
    return (
        <Main className='max-w-(--breakpoint-lg) mx-auto flex flex-col'>
            <H fancy className='text-5xl md:hidden'>Memories</H>
            <div className={cn('italic text-center text-xl md:hidden mb-4 text-default-700', ENGLISH_FANCY.className)}>Record your learnings</div>
            <div className='flex flex-col md:flex-row-reverse gap-8'>
                <section className='md:basis-1/3 items-center flex flex-col'>
                    <H fancy className='text-5xl lg:text-6xl hidden md:block'>Memories</H>
                    <div className={cn('italic hidden md:block text-xl lg:text-2xl mb-4 text-default-700', ENGLISH_FANCY.className)}>Record your learnings</div>
                    <CreateMemoryForm />
                    <Spacer y={4} />
                    <div style={{ fontFamily: contentFontFamily }} className='text-sm text-default-600 text-balance text-center max-w-52'>
                        Memories 是一个日记本功能。
                        <br></br>
                        打卡 Memory 会在设置中显示连续打卡天数（Streak）。
                    </div>
                </section>
                <section className='md:basis-full w-full justify-start flex'>
                    <MemoryTabs
                        personalFeed={<PersonalFeed />}
                        federatedFeed={<FederatedFeed />}
                    />
                </section>
            </div>
        </Main>
    )
}