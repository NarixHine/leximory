import { Metadata } from 'next'
import { SignIn } from '@clerk/nextjs'

export const metadata: Metadata = { title: '登录' }

export default function Page() {
    return <SignIn path='/sign-in' />
}
