import Reader from '@/components/reader'
import { ReactNode } from 'react'

export default function LibLayout({
    children,
}: {
    children: ReactNode
}) {
    return (<Reader>
        {children}
    </Reader>)
}
