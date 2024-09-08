import { auth, currentUser } from '@clerk/nextjs/server'
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

export default async function Nav(props: NavProps) {
    const { orgSlug } = auth()
    const tenant = orgSlug ?? (await currentUser())!.username ?? 'You'
    return <NavBreadcrumbs {...props} tenant={tenant}></NavBreadcrumbs>
}
