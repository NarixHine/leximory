'use client'

import { HeroUIProvider } from "@heroui/system"
import { useRouter } from 'next/navigation'
import { ThemeProvider } from 'next-themes'
import { ReactNode } from 'react'
import { Provider as JotaiProvider } from 'jotai'
import { Toaster } from 'sonner'
import { cn } from '@/lib/utils'
import { ThemeProviderProps } from 'next-themes/dist/types'
import { CHINESE } from "@/lib/fonts"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

export interface ProvidersProps {
	children: ReactNode
	themeProps?: ThemeProviderProps
}

export function Providers({ children, themeProps }: ProvidersProps) {
	const router = useRouter()

	return (<HeroUIProvider navigate={router.push}>
		<ThemeProvider {...themeProps}>
			<JotaiProvider>
				<Toaster toastOptions={{
					classNames: {
						toast: cn('!text-default-900 !bg-stone-50 dark:!bg-stone-800 !border !border-stone-200 dark:!border-stone-700 !shadow-none', CHINESE.className)
					},
				}}></Toaster>
				<QueryProvider>
					{children}
				</QueryProvider>
			</JotaiProvider>
		</ThemeProvider>
	</HeroUIProvider>)
}

const queryClient = new QueryClient()

function QueryProvider({ children }: { children: ReactNode }) {
	return (
		<QueryClientProvider client={queryClient}>
			{children}
		</QueryClientProvider>
	)
}
