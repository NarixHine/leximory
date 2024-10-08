'use client'

import { NextUIProvider } from '@nextui-org/react'
import { useRouter } from 'next/navigation'
import { ThemeProvider } from 'next-themes'
import { ReactNode } from 'react'
import { ClerkProvider } from '@clerk/nextjs'
import { zhCN } from '@clerk/localizations'
import { useSystemColorMode } from 'react-use-system-color-mode'
import { dark } from '@clerk/themes'
import { Provider as JotaiProvider } from 'jotai'
import { Toaster } from 'sonner'
import { cn } from '@/lib/utils'
import { CHINESE_ZCOOL } from '@/lib/fonts'
import { RenderingBoundary } from 'jotai-ssr'
import { ThemeProviderProps } from 'next-themes/dist/types'

export interface ProvidersProps {
	children: ReactNode
	themeProps?: ThemeProviderProps
}

export function Providers({ children, themeProps }: ProvidersProps) {
	const router = useRouter()
	const mode = useSystemColorMode()
	return (
		<ClerkProvider localization={zhCN} afterSignOutUrl={'/'} appearance={{ baseTheme: mode === 'dark' ? dark : undefined }}>
			<NextUIProvider navigate={router.push}>
				<ThemeProvider {...themeProps}>
					<JotaiProvider>
						<RenderingBoundary>
							<Toaster toastOptions={{
								classNames: {
									toast: cn('bg-primary-200 text-primary-900 dark:bg-danger-800 dark:border-0 dark:text-primary-100', CHINESE_ZCOOL.className),
								}
							}}></Toaster>
							{children}
						</RenderingBoundary>
					</JotaiProvider>
				</ThemeProvider>
			</NextUIProvider>
		</ClerkProvider>
	)
}
