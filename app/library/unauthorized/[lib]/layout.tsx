import { authReadToLibWithoutThrowing } from '@/server/auth/role'
import { HydrationBoundary } from 'jotai-ssr'
import { ReactNode } from 'react'
import { getLib } from '@/server/db/lib'
import { LibProps } from '@/lib/types'
import { redirect } from 'next/navigation'
import { isStarredAtom, libAtom, priceAtom } from '../../[lib]/atoms'

export async function generateMetadata(props: LibProps) {
    const params = await props.params
    const { name } = await getLib({ id: params.lib })
    return {
        title: {
            default: `获取文库 | ${name} | Leximory`,
            template: `获取文库 | ${name} | Leximory`
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

    const { isOwner, isStarred, price } = await authReadToLibWithoutThrowing(params.lib)

    if (isOwner || isStarred) {
        redirect(`/library/${params.lib}`)
    }

    return (<HydrationBoundary hydrateAtoms={[
        [libAtom, params.lib],
        [isStarredAtom, false],
        [priceAtom, price]
    ]}>
        {children}
    </HydrationBoundary>)
}
