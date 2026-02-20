import { getLib } from '@/server/db/lib'
import { Kilpi } from '@repo/service/kilpi'
import { getUserOrThrow } from '@repo/user'
import { libAtom, isReadOnlyAtom, isStarredAtom, langAtom, priceAtom } from './atoms'
import { Lang, LIB_ACCESS_STATUS } from '@repo/env/config'
import { HydrationBoundary } from 'jotai-ssr'
import { ReactNode, Suspense } from 'react'
import { LibProps } from '@/lib/types'
import { redirect } from 'next/navigation'
import Main from '@/components/ui/main'
import { Spinner } from '@heroui/spinner'
import Center from '@/components/ui/center'

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

    const { userId } = await getUserOrThrow()
    const libData = await getLib({ id: p.lib })
    const isOwner = libData.owner === userId
    const isReadOnly = !isOwner
    const isStarred = Boolean(libData.starred_by?.includes(userId))
    const lang = libData.lang as Lang
    const price = libData.price
    const access = libData.access

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
        <Suspense fallback={<Center><Spinner variant='wave' color='default' /></Center>}>
            <LibLayoutContent params={props.params} children={props.children} />
        </Suspense>
    )
}
