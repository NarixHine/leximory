import Center from '@/components/ui/center'
import { ReactNode } from 'react'

export default function Layout({ children }: { children: ReactNode }) {
    return <Center>
        {children}
    </Center>
}
