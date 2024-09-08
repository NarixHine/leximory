'use client'

import { NextUIProvider } from '@nextui-org/system'
import { useRouter } from 'next/navigation'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { ThemeProviderProps } from 'next-themes/dist/types'
import { ReactNode } from 'react'
import { ClerkProvider } from '@clerk/nextjs'
import { zhCN } from '@clerk/localizations'
import { useSystemColorMode } from 'react-use-system-color-mode'
import { dark } from '@clerk/themes'
import { Provider as JotaiProvider } from 'jotai'
import { Toaster } from 'sonner'
import { cn } from '@/lib/utils'
import { xw } from '@/lib/fonts'
import { RenderingBoundary } from 'jotai-ssr'

export interface ProvidersProps {
	children: ReactNode
	themeProps?: ThemeProviderProps
}

export function Providers({ children, themeProps }: ProvidersProps) {
	const router = useRouter()
	const mode = useSystemColorMode()
	return (
		<ClerkProvider localization={zhCN} appearance={{ baseTheme: mode === 'dark' ? dark : undefined }}>
			<NextUIProvider navigate={router.push}>
				<NextThemesProvider {...themeProps}>
					<JotaiProvider>
						<RenderingBoundary>
							<Toaster toastOptions={{
								classNames: {
									toast: cn('bg-primary-200 text-primary-900 dark:bg-danger-800 dark:border-0 dark:text-primary-100', xw.className),
								}
							}}></Toaster>
							{children}
						</RenderingBoundary>
					</JotaiProvider>
				</NextThemesProvider>
			</NextUIProvider>
		</ClerkProvider>
	)
}
