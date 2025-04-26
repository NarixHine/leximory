import { getPaginatedPublicLibs } from '@/server/db/lib'
import { auth } from '@clerk/nextjs/server'
import LibraryCard from '@/app/marketplace/[page]/components/card'
import UserAvatar from '@/components/avatar'
import { unstable_cacheLife as cacheLife } from 'next/cache'
import H from '@/components/ui/h'

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
    const { userId } = await auth()
    const publicLibraries = await getPublicLibraries(uid, userId)

    if (publicLibraries.length === 0) {
        return null
    }

    return (
        <div className='basis-3/5'>
            <H className='text-xl mb-4'>公开文库</H>
            <div className='grid grid-cols-1 gap-5 lg:grid-cols-2'>
                {publicLibraries.map((lib) => (
                    <LibraryCard
                        hideAvatar
                        key={lib.id}
                        library={{
                            id: lib.id,
                            name: lib.name,
                            lang: lib.lang,
                            owner: lib.owner,
                            price: lib.price
                        }}
                        isStarred={lib.isStarred}
                        avatar={<UserAvatar uid={lib.owner} />}
                    />
                ))}
            </div>
        </div>
    )
} 