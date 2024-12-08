import { Metadata } from 'next'
import Center from '@/components/center'
import { ClerkLoading, SignUp } from '@clerk/nextjs'
import { CircularProgress } from '@nextui-org/progress'

export const metadata: Metadata = { title: '注册' }

export default function Page() {
    return <Center>
        <ClerkLoading>
            <CircularProgress color='primary' />
        </ClerkLoading>
        <SignUp path='/sign-up' />
    </Center>
}
