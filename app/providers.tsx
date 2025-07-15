'use client'

import { HeroUIProvider } from "@heroui/system"
import { useRouter } from 'next/navigation'
import { ThemeProvider } from 'next-themes'
import { ReactNode } from 'react'
import { ms } from 'itty-time'
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
						toast: cn('!text-default-900 !bg-stone-50 !dark:!bg-stone-800 !dark:text-default-100 !border !border-stone-300 !dark:!border-stone-600 !shadow-none', CHINESE.className),
					},
				}}></Toaster>
				<QueryProvider>
					{children}
				</QueryProvider>
			</JotaiProvider>
		</ThemeProvider>
	</HeroUIProvider>)
}

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: ms('5 minutes'),
			gcTime: ms('10 minutes'),
		},
	},
})

function QueryProvider({ children }: { children: ReactNode }) {
	return (
		<QueryClientProvider client={queryClient}>
			{children}
		</QueryClientProvider>
	)
}
