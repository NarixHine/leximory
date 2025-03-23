import Center from '@/components/ui/center'
import { ClerkLoading } from '@clerk/nextjs'
import { CircularProgress } from "@heroui/progress"
import { ReactNode } from 'react'

export default function Layout({ children }: { children: ReactNode }) {
    return <Center>
        <ClerkLoading>
            <CircularProgress color='primary' />
        </ClerkLoading>
        {children}
    </Center>
}
