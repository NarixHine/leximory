import { Metadata } from 'next'
import { UserProfile } from '@clerk/nextjs'
import Center from '@/components/ui/center'

export const metadata: Metadata = { title: '用户资料' }

export default function Page() {
    return <Center>
        <UserProfile path='/settings/user' />
    </Center>
}
