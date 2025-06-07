import { getUserOrThrow } from '@/server/auth/user'
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
    const user = await getUserOrThrow()
    const tenant = user.username ?? 'You'
    return <NavBreadcrumbs {...props} tenant={tenant} />
}
