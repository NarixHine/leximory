import { Metadata } from 'next'
import Center from '@/components/center'
import { ClerkLoading, SignIn } from '@clerk/nextjs'
import { CircularProgress } from '@nextui-org/progress'

export const metadata: Metadata = { title: '登录' }

export default function Page() {
    return <Center>
        <ClerkLoading>
            <CircularProgress color='primary' />
        </ClerkLoading>
        <SignIn path='/sign-in' />
    </Center>
}
