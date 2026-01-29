import { Metadata } from 'next'

export const metadata: Metadata = { title: { default: '设置', template: '%s | 设置 | Leximory' } }

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
        </>
    )
}
