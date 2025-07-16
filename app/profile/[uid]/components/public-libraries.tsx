import { getPaginatedPublicLibs } from '@/server/db/lib'
import { getUserOrThrow } from '@/server/auth/user'
import LibraryCard from '@/app/marketplace/[page]/components/card'
import UserAvatar from '@/components/avatar'
import { unstable_cacheLife as cacheLife } from 'next/cache'
import { PiEmptyThin } from 'react-icons/pi'

async function getPublicLibraries(uid: string, userId?: string | null) {
    'use cache'
    cacheLife('days')
    const libs = await getPaginatedPublicLibs({ page: 1, size: 10 })
    return libs.filter(lib => lib.owner === uid).map(lib => ({
        ...lib,
        isStarred: userId ? lib.starredBy?.includes(userId) ?? false : false
    }))
}

export default async function PublicLibraries({ uid }: { uid: string }) {
    const { userId } = await getUserOrThrow()
    const publicLibraries = await getPublicLibraries(uid, userId)

    if (publicLibraries.length === 0) {
        return (<div className='flex flex-col items-center gap-4 h-full justify-center'>
            <p className='text-center text-default-400'>TA 正在埋头学习，暂无公开文库。</p>
            <PiEmptyThin className='text-default-400' size={100} />
        </div>)
    }

    return (<div className='grid grid-cols-1 gap-5 lg:grid-cols-2'>
        {publicLibraries.map((lib) => (
            <LibraryCard
                hideFooter
                key={lib.id}
                library={{
                    id: lib.id,
                    name: lib.name,
                    lang: lib.lang,
                    owner: lib.owner,
                    price: lib.price,
                    readers: lib.starredBy?.length ?? 0
                }}
                isOwner={lib.owner === userId}
                isStarred={lib.isStarred}
                avatar={<UserAvatar uid={lib.owner} />}
            />
        ))}
    </div>)
} 