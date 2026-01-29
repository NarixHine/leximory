import { authReadToLibWithoutThrowing } from '@/server/auth/role'
import { libAtom, isReadOnlyAtom, isStarredAtom, langAtom, priceAtom } from './atoms'
import { Lang, LIB_ACCESS_STATUS } from '@repo/env/config'
import { HydrationBoundary } from 'jotai-ssr'
import { ReactNode, Suspense } from 'react'
import { getLib } from '@/server/db/lib'
import { LibProps } from '@/lib/types'
import { redirect } from 'next/navigation'
import NavBreadcrumbs from '@/components/nav/breadcrumbs'
import Main from '@/components/ui/main'

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

async function LibLayoutContent({
    params,
    children
}: {
    params: Promise<{ lib: string }>
    children: ReactNode
}) {
    const p = await params

    const { isReadOnly, isOwner, lang, price, access, isStarred } = await authReadToLibWithoutThrowing(p.lib)

    // Redirect to unauthorized page if user is not owner and hasn't starred the library
    if (!isOwner && !isStarred) {
        if (access === LIB_ACCESS_STATUS.public)
            redirect(`/library/unauthorized/${p.lib}`)
        else
            throw new Error('Access denied to this library')
    }

    return (<HydrationBoundary options={{
        enableReHydrate: true
    }} hydrateAtoms={[
        [libAtom, p.lib],
        [isReadOnlyAtom, isReadOnly],
        [langAtom, lang as Lang],
        [isStarredAtom, isStarred],
        [priceAtom, price]
    ]}>
        {children}
    </HydrationBoundary>)
}

export default function LibLayout(
    props: {
        children: ReactNode
        params: Promise<{ lib: string }>
    }
) {
    return (
        <Suspense fallback={<Main><NavBreadcrumbs loading /></Main>}>
            <LibLayoutContent params={props.params} children={props.children} />
        </Suspense>
    )
}
