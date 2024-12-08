import { Metadata } from 'next'
import { UserProfile } from '@clerk/nextjs'

export const metadata: Metadata = { title: '用户资料' }

export default function Page() {
    return <UserProfile path='/settings/user' />
}
