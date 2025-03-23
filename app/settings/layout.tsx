import { Metadata } from 'next'
import { ClerkLoading } from '@clerk/nextjs'
import { CircularProgress } from "@heroui/progress"
import Center from '@/components/ui/center'

export const metadata: Metadata = { title: { default: '设置', template: '%s | 设置 | Leximory' } }

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <ClerkLoading>
                <Center>
                    <CircularProgress color='primary' />
                </Center>
            </ClerkLoading>
            {children}
        </>
    )
}
