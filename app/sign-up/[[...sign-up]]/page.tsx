import { Metadata } from 'next'
import Center from '@/components/center'
import { SignUp } from '@clerk/nextjs'

export const metadata: Metadata = { title: '注册' }

export default function Page() {
    return <Center>
    <SignUp path='/sign-up' />
    </Center>
}
