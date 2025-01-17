import { Metadata } from 'next'
import { ClerkLoading } from '@clerk/nextjs'
import { CircularProgress } from "@heroui/progress"
import Center from '@/components/ui/center'

export const metadata: Metadata = { title: '设置' }

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <Center>
            <ClerkLoading>
                <CircularProgress color='primary' />
            </ClerkLoading>
            {children}
        </Center>
    )
}
