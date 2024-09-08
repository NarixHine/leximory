import { Metadata } from 'next'
import Center from '@/components/center'
import { SignIn } from '@clerk/nextjs'

export const metadata: Metadata = { title: '登录' }

export default function Page() {
    return <Center>
        <SignIn path='/sign-in' />
    </Center>
}
