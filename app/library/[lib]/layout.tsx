import { authReadToLib } from '@/server/auth/role'
import Prompt from './components/prompt'
import { libAtom, isReadOnlyAtom, isStarredAtom, langAtom, priceAtom } from './atoms'
import { Lang } from '@/lib/config'
import { HydrationBoundary } from 'jotai-ssr'
import { ReactNode } from 'react'
import { getLib } from '@/server/db/lib'
import { LibProps } from '@/lib/types'
import { getUserOrThrow } from '@/server/auth/user'

export async function generateMetadata(props: LibProps) {
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

    const { starredBy, isReadOnly, isOwner, lang, price } = await authReadToLib(params.lib)
    const { userId } = await getUserOrThrow()
    const isStarred = Boolean(starredBy?.includes(userId))
    return (<HydrationBoundary options={{
        enableReHydrate: true
    }} hydrateAtoms={[
        [libAtom, params.lib],
        [isReadOnlyAtom, isReadOnly],
        [langAtom, lang as Lang],
        [isStarredAtom, isStarred],
        [priceAtom, price]
    ]}>
        {!isOwner && !isStarred && <Prompt></Prompt>}
        {children}
    </HydrationBoundary>)
}
