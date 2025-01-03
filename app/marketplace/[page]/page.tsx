import { getXataClient } from '@/lib/xata'
import Main from '@/components/main'
import { libAccessStatusMap, Lang } from '@/lib/config'
import Pagination from './pagination'
import LibraryCard, { LibraryCardSkeleton } from './card'
import { auth } from '@clerk/nextjs/server'
import { Spacer } from '@nextui-org/spacer'
import { Suspense } from 'react'
import H from '@/components/h'
import { PiStorefrontDuotone } from 'react-icons/pi'
import { Alert } from '@nextui-org/alert'
import { CHINESE_ZCOOL } from '@/lib/fonts'
import { cn } from '@/lib/utils'

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
    const { orgId } = await auth()

    return (
        <Main className='max-w-screen-lg'>
            <H className='text-5xl'><PiStorefrontDuotone />文库集市</H>
            <Spacer y={10} />
            {
                orgId ?
                    <Alert description='收藏文库在个人工作区中才会显示' color='warning' variant='bordered' classNames={{ title: cn('text-md', CHINESE_ZCOOL.className), description: cn('text-xs', CHINESE_ZCOOL.className), base: 'mb-5' }} title='你正在小组工作区中'></Alert> :
                    <Alert description={`Moderator's E-mail: report@leximory.com`} color='warning' variant='bordered' classNames={{ title: cn('text-md', CHINESE_ZCOOL.className), description: 'text-xs', base: 'mb-5' }} title='共享文库由用户发布'></Alert>
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
