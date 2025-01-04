import { authReadToLib } from '@/lib/auth'
import { auth } from '@clerk/nextjs/server'
import Prompt from './prompt'
import { getXataClient } from '@/lib/xata'
import Star from './star'
import { libAtom, isReadOnlyAtom, isStarredAtom, langAtom } from './atoms'
import { Lang } from '@/lib/config'
import { HydrationBoundary } from 'jotai-ssr'
import { ReactNode } from 'react'
import UserAvatar from '@/components/avatar'
import Reader from '@/components/reader'

export async function generateMetadata(props: LibParams) {
    const params = await props.params
    const xata = getXataClient()
    const rec = await xata.db.libraries.select(['name']).filter({ id: params.lib }).getFirstOrThrow()
    return {
        title: {
            default: rec.name,
            template: `%s | ${rec.name} | Leximory`
        }
    }
}

export default async function LibLayout(
    props: {
        children: ReactNode
        params: Promise<{ lib: string }>
    }
) {
    const params = await props.params

    const {
        children
    } = props

    const { rec, isReadOnly, isOrganizational, isOwner } = await authReadToLib(params.lib)
    const { starredBy } = rec
    const { userId } = await auth()
    const isStarred = Boolean(starredBy?.includes(userId!))
    return (<HydrationBoundary options={{
        enableReHydrate: true
    }} hydrateAtoms={[
        [libAtom, rec.id],
        [isReadOnlyAtom, isReadOnly],
        [langAtom, rec.lang as Lang],
        [isStarredAtom, isStarred]
    ]}>
        <Reader>
            {!isOwner && !isStarred && !isOrganizational && <Prompt></Prompt>}
            <div className='flex flex-col items-center gap-2 fixed bottom-3 right-3'>
                {
                    !isOwner && !isOrganizational &&
                    <>
                        <UserAvatar uid={rec.owner}></UserAvatar>
                        <Star></Star>
                    </>
                }
            </div>
            {children}
        </Reader>
    </HydrationBoundary>)
}
