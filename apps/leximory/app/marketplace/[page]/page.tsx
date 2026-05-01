import Main from '@/components/ui/main'
import Pagination from './pagination'
import { MARKETPLACE_PAGE_SIZE } from '@repo/env/config'
import LibraryCard from './components/card'
import { Spacer } from "@heroui/spacer"
import { Suspense } from 'react'
import { PiStorefrontDuotone } from 'react-icons/pi'
import { getPaginatedPublicLibs } from '@/server/db/lib'
import { getUserOrThrow } from '@repo/user'
import { LibrarySkeleton } from '@/app/library/components/lib'

async function LibraryList({ page }: {
    page: number
}) {
    const { userId } = await getUserOrThrow()
    const libs = await getPaginatedPublicLibs({ page, size: MARKETPLACE_PAGE_SIZE })
    return (
        <div className='columns-1 gap-4 md:columns-2 space-y-4 max-w-125 sm:max-w-150 mx-auto'>
            {libs.map((lib) => (
                <LibraryCard
                    library={{
                        id: lib.id,
                        name: lib.name,
                        lang: lib.lang,
                        owner: lib.owner,
                        price: lib.price,
                        readers: lib.starredBy?.length ?? 0
                    }}
                    isOwner={lib.owner === userId}
                    isStarred={lib.starredBy?.includes(userId!) ?? false}
                    key={lib.id}
                />
            ))}
        </div>
    )
}

export default async function MarketplacePage({ params }: {
    params: Promise<{
        page: string
    }>
}) {
    const page = parseInt((await params).page)

    return (
        <Main className='max-w-(--breakpoint-lg) flex flex-col'>
            {/* Header */}
            <header className='mb-6 mx-auto w-full px-7 max-w-125 sm:max-w-150 space-y-1'>
                <div className='flex items-center gap-2 text-default-400'>
                    <PiStorefrontDuotone className='size-5' />
                    <span className='text-xs font-mono uppercase tracking-wide'>
                        Library Exchange
                    </span> 
                </div>
                <div className='flex items-end gap-0.5'>
                    <h1 className='font-kaiti text-3xl'>
                        文库交换所
                    </h1>
                </div>
            </header>
            <Spacer y={5} />
            <Suspense fallback={<SuspenseLibraryList />}>
                <LibraryList page={page} />
            </Suspense>
            <Spacer y={10} />
            <Pagination page={page} />
        </Main>
    )
}

const SuspenseLibraryList = () => (
    <section className='w-full max-w-125 sm:max-w-150 mx-auto'>
        <div className='columns-1 sm:columns-2 sm:gap-4 space-y-4'>
            <LibrarySkeleton rowCount={6} />
            <LibrarySkeleton rowCount={1} />
            <LibrarySkeleton rowCount={2} />
            <LibrarySkeleton rowCount={5} />
        </div>
    </section>
)
