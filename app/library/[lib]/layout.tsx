import { authReadToLib } from '@/lib/auth'
import { auth } from '@clerk/nextjs/server'
import Prompt from './components/prompt'
import Star from './components/star'
import { libAtom, isReadOnlyAtom, isStarredAtom, langAtom } from './atoms'
import { Lang } from '@/lib/config'
import { HydrationBoundary } from 'jotai-ssr'
import { ReactNode } from 'react'
import UserAvatar from '@/components/avatar'
import Reader from '@/components/reader'
import { getLib } from '@/server/db/lib'
import { LibParams } from '@/lib/types'

export async function generateMetadata(props: LibParams) {
    const params = await props.params
    const { name } = await getLib({ id: params.lib })
    return {
        title: {
            default: name,
            template: `%s | ${name} | Leximory`
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

    const { starredBy, isReadOnly, isOrganizational, isOwner, lang, owner } = await authReadToLib(params.lib)
    const { userId } = await auth()
    const isStarred = Boolean(starredBy?.includes(userId!))
    return (<HydrationBoundary options={{
        enableReHydrate: true
    }} hydrateAtoms={[
        [libAtom, params.lib],
        [isReadOnlyAtom, isReadOnly],
        [langAtom, lang as Lang],
        [isStarredAtom, isStarred]
    ]}>
        <Reader>
            {!isOwner && !isStarred && !isOrganizational && <Prompt></Prompt>}
            <div className='flex flex-col items-center gap-2 fixed bottom-3 right-3'>
                {
                    !isOwner && !isOrganizational &&
                    <>
                        <UserAvatar uid={owner}></UserAvatar>
                        <Star></Star>
                    </>
                }
            </div>
            {children}
        </Reader>
    </HydrationBoundary>)
}
