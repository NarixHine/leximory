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
        <Main className='max-w-(--breakpoint-lg) flex flex-col mx-auto pt-12'>
            <header className='mb-2 mx-auto w-full max-w-108 sm:max-w-133 flex items-start gap-3 sm:items-center flex-col sm:flex-row sm:gap-6'>
                <h1 className='text-3xl flex items-center gap-1 font-formal text-default-500 ml-5 sm:ml-0'>
                    <PiStorefrontDuotone className='size-8' />   文库集市
                </h1>
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
