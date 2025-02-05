import FollowUs from './components/follow-us'
import { cookies } from 'next/headers'

export default async function LibraryLayout({ children }: { children: React.ReactNode }) {
    const cookieStore = await cookies()
    const hasShownFollowUsModal = cookieStore.get('has-shown-follow-us-modal')

    return <>
        {!hasShownFollowUsModal && <FollowUs />}
        {children}
    </>
}
