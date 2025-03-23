import FollowUs from './components/follow-us'
import { cookies } from 'next/headers'
import { Suspense } from 'react'

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
    return <>
        <Suspense>
            <SelectiveFollowUsModal />
        </Suspense>
        {children}
    </>
}

async function SelectiveFollowUsModal() {
    const cookieStore = await cookies()
    const hasShownFollowUsModal = cookieStore.get('has-shown-follow-us-modal')
    return hasShownFollowUsModal ? <></> : <FollowUs />
}
