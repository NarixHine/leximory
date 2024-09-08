import { Metadata } from 'next'
import Center from '@/components/center'
import { UserProfile } from '@clerk/nextjs'

export const metadata: Metadata = { title: '用户资料' }

export default function Page() {
    return <Center>
        <UserProfile path='/user' />
    </Center>
}
