'use client'

import { HeroUIProvider } from '@heroui/system'
import { useRouter } from 'next/navigation'
import { ThemeProvider } from 'next-themes'
import { ReactNode, Suspense, useEffect } from 'react'
import { Provider as JotaiProvider } from 'jotai'
import { toast, Toaster } from 'sonner'
import { cn } from '@/lib/utils'
import { ThemeProviderProps } from 'next-themes/dist/types'
import { MINCHO } from '@/lib/fonts'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SerwistProvider } from '@serwist/next/react'

export interface ProvidersProps {
	children: ReactNode
	themeProps?: ThemeProviderProps
}

const useRegisterSW = () => {
	useEffect(() => {
		if ('serviceWorker' in navigator && window.matchMedia('(display-mode: standalone)').matches) {
			navigator.serviceWorker.register('/sw.js', { scope: '/' })
				.then(reg => console.log('SW registered:', reg))
				.catch(() => toast.error('SW 注册失败'))
		}
	}, [])
}

export function Providers({ children, themeProps }: ProvidersProps) {
	const router = useRouter()
	useRegisterSW()

	return (<Suspense>
		<SerwistProvider swUrl='/sw.js'>
			<HeroUIProvider navigate={router.push}>
				<ThemeProvider {...themeProps}>
					<JotaiProvider>
						<Toaster toastOptions={{
							classNames: {
								toast: cn(
									'text-foreground! bg-secondary-200/40!',
									'px-6! rounded-3xl!',
									'border-none! shadow-none!',
									'backdrop-blur-lg! backdrop-saturate-150!',
									MINCHO.className
								)
							},
						}}></Toaster>
						<QueryProvider>
							{children}
						</QueryProvider>
					</JotaiProvider>
				</ThemeProvider>
			</HeroUIProvider>
		</SerwistProvider>
	</Suspense>)
}

const queryClient = new QueryClient()

function QueryProvider({ children }: { children: ReactNode }) {
	return (
		<QueryClientProvider client={queryClient}>
			{children}
		</QueryClientProvider>
	)
}
