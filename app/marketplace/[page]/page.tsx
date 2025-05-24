import Main from '@/components/ui/main'
import Pagination from './pagination'
import { MARKETPLACE_PAGE_SIZE } from '@/lib/config'
import LibraryCard, { LibraryCardSkeleton } from './components/card'
import { auth } from '@clerk/nextjs/server'
import { Spacer } from "@heroui/spacer"
import { Suspense } from 'react'
import H from '@/components/ui/h'
import { PiStorefrontDuotone } from 'react-icons/pi'
import { Alert } from "@heroui/alert"
import { CHINESE_ZCOOL } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import UserAvatar from '@/components/avatar'
import { getPaginatedPublicLibs } from '@/server/db/lib'

async function LibraryList({ page }: {
    page: number
}) {
    const { userId } = await auth()
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
    const { orgId } = await auth()

    return (
        <Main className='max-w-screen-lg'>
            <H className='text-5xl'><PiStorefrontDuotone />文库集市</H>
            <Spacer y={10} />
            {
                orgId ?
                    <Alert description='收藏文库在个人工作区中才会显示' color='primary' variant='bordered' classNames={{ title: cn('text-md', CHINESE_ZCOOL.className), description: cn('text-xs', CHINESE_ZCOOL.className), base: 'mb-5' }} title='你正在小组工作区中'></Alert> :
                    <Alert description={`Moderator's E-mail: report@leximory.com`} color='primary' variant='bordered' classNames={{ title: cn('text-md', CHINESE_ZCOOL.className), description: 'text-xs', base: 'mb-5' }} title='共享文库由用户发布'></Alert>
            }
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
        {Array.from({ length: 6 }).map((_, i) => (
            <LibraryCardSkeleton key={i} />
        ))}
    </div>
)
