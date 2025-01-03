import { getXataClient } from '@/lib/xata'
import Main from '@/components/main'
import { libAccessStatusMap, Lang } from '@/lib/config'
import Pagination from './pagination'
import LibraryCard, { LibraryCardSkeleton } from './card'
import { auth } from '@clerk/nextjs/server'
import { Spacer } from '@nextui-org/spacer'
import { Suspense } from 'react'

const PAGE_SIZE = 12

async function LibraryList({ page }: {
    page: number
}) {
    const xata = getXataClient()
    const { userId } = await auth()
    const { records } = await xata.db.libraries
        .filter({ access: libAccessStatusMap.public })
        .sort('xata.createdAt', 'desc')
        .select(['id', 'name', 'lang', 'owner', 'starredBy'])
        .getPaginated({
            pagination: { size: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }
        })
    return (
        <div className='grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3'>
            {records.map((lib) => (
                <LibraryCard
                    library={{
                        id: lib.id,
                        name: lib.name,
                        lang: lib.lang as Lang,
                    }}
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
        <Main className='max-w-screen-lg'>
            <Pagination page={page} />
            <Spacer y={10} />
            <Suspense fallback={<SuspenseLibraryList />}>
                <LibraryList page={page} />
            </Suspense>
        </Main>
    )
}

const SuspenseLibraryList = () => (
    <div className='grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3'>
        {Array.from({ length: 6 }).map((_, i) => (
            <LibraryCardSkeleton key={i} />
        ))}
    </div>
)
