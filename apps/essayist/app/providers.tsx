'use client'

import { HeroUIProvider } from '@heroui/react'
import { useRouter } from 'next/navigation'
import { ThemeProvider, ThemeProviderProps } from 'next-themes'
import { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@repo/ui/auth'

const queryClient = new QueryClient()

export default function Providers({ children, themeProps }: {
    children: ReactNode
    themeProps?: ThemeProviderProps
}) {
    const router = useRouter()
    return (
        <AuthProvider>
            <QueryClientProvider client={queryClient}>
                <HeroUIProvider navigate={router.push}>
                    <ThemeProvider {...themeProps}>
                        {children}
                    </ThemeProvider>
                </HeroUIProvider>
            </QueryClientProvider>
        </AuthProvider>
    )
}
