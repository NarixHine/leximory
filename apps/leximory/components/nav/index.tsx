import { Suspense } from 'react'
import { getUserOrThrow } from '@repo/user'
import NavBreadcrumbs from './breadcrumbs'

export type NavProps = {
    lib?: {
        id: string
        name: string
    }
    text?: {
        id: string
        name: string
    }
    isAtCorpus?: boolean
}

async function NavContent(props: NavProps) {
    const user = await getUserOrThrow()
    const tenant = user.username ?? 'You'
    return <NavBreadcrumbs {...props} tenant={tenant} />
}

export default function Nav(props: NavProps) {
    return (
        <Suspense fallback={<NavBreadcrumbs {...props} loading />}>
            <NavContent {...props} />
        </Suspense>
    )
}
