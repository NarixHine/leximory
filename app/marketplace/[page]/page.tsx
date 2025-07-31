import Main from '@/components/ui/main'
import Pagination from './pagination'
import { MARKETPLACE_PAGE_SIZE } from '@/lib/config'
import LibraryCard, { LibraryCardSkeleton } from './components/card'
import { Spacer } from "@heroui/spacer"
import { Suspense } from 'react'
import H from '@/components/ui/h'
import { PiStorefrontDuotone } from 'react-icons/pi'
import UserAvatar from '@/components/avatar'
import { getPaginatedPublicLibs } from '@/server/db/lib'
import { getUserOrThrow } from '@/server/auth/user'

async function LibraryList({ page }: {
    page: number
}) {
    const { userId } = await getUserOrThrow()
    const libs = await getPaginatedPublicLibs({ page, size: MARKETPLACE_PAGE_SIZE })
    return (
        <div className='grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3'>
            {libs.map((lib) => (
                <LibraryCard
                    avatar={<UserAvatar uid={lib.owner} />}
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
            <H className='text-5xl font-bold dark:text-amber-500 text-amber-600'><PiStorefrontDuotone />文库集市</H>
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
