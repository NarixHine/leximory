import { Metadata } from 'next'
import { SignUp } from '@clerk/nextjs'

export const metadata: Metadata = { title: '注册' }

export default function Page() {
    return <SignUp path='/sign-up' />
}
