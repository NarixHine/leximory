import { authReadToLibWithoutThrowing } from '@/server/auth/role'
import { libAtom, isReadOnlyAtom, isStarredAtom, langAtom, priceAtom } from './atoms'
import { Lang, libAccessStatusMap } from '@/lib/config'
import { HydrationBoundary } from 'jotai-ssr'
import { ReactNode } from 'react'
import { getLib } from '@/server/db/lib'
import { LibProps } from '@/lib/types'
import { redirect } from 'next/navigation'

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

    const { isReadOnly, isOwner, lang, price, access, isStarred } = await authReadToLibWithoutThrowing(params.lib)

    // Redirect to unauthorized page if user is not owner and hasn't starred the library
    if (!isOwner && !isStarred) {
        if (access === libAccessStatusMap.public)
            redirect(`/library/unauthorized/${params.lib}`)
        else
            throw new Error('Access denied to this library')
    }

    return (<HydrationBoundary options={{
        enableReHydrate: true
    }} hydrateAtoms={[
        [libAtom, params.lib],
        [isReadOnlyAtom, isReadOnly],
        [langAtom, lang as Lang],
        [isStarredAtom, isStarred],
        [priceAtom, price]
    ]}>
        {children}
    </HydrationBoundary>)
}
