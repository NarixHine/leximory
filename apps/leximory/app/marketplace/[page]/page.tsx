import Main from '@/components/ui/main'
import Pagination from './pagination'
import { MARKETPLACE_PAGE_SIZE } from '@repo/env/config'
import LibraryCard, { LibraryCardSkeleton } from './components/card'
import { Spacer } from "@heroui/spacer"
import { Suspense } from 'react'
import { PiStorefrontDuotone } from 'react-icons/pi'
import { getPaginatedPublicLibs } from '@/server/db/lib'
import { getUserOrThrow } from '@repo/user'

async function LibraryList({ page }: {
    page: number
}) {
    const { userId } = await getUserOrThrow()
    const libs = await getPaginatedPublicLibs({ page, size: MARKETPLACE_PAGE_SIZE })
    return (
        <div className='grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3'>
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
        <Main className='max-w-(--breakpoint-lg) flex flex-col mx-auto'>
            <header className='mx-auto w-full max-w-108 sm:max-w-133 mt-2'>
                <div className='flex items-center gap-2 text-default-500'>
                    <PiStorefrontDuotone className='size-8' />
                    <h1 className='font-formal text-3xl'>
                        我的文库
                    </h1>
                </div>
            </header>
            <Spacer y={10} />
            <Suspense fallback={<SuspenseLibraryList />}>
                <LibraryList page={page} />
            </Suspense>
            <Spacer y={10} />
            <Pagination page={page} />
        </Main>
    )
}

const SuspenseLibraryList = () => (
    <div className='grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3'>
        {Array.from({ length: 9 }).map((_, i) => (
            <LibraryCardSkeleton key={i} />
        ))}
    </div>
)
