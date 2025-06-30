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
						toast: cn('!bg-white dark:!bg-default-50 dark:!border-0 !text-default-900 !dark:text-default-100', CHINESE.className),
					}
				}}></Toaster>
				{children}
			</JotaiProvider>
		</ThemeProvider>
	</HeroUIProvider>)
}
