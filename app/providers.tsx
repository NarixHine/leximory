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
import dynamic from 'next/dynamic'

const PWAPrompt = dynamic(() => import('react-ios-pwa-prompt'), { ssr: false })

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
									toast: cn('bg-primary-200 text-primary-900 dark:bg-danger-800 dark:border-0 dark:text-primary-100 opacity-60', CHINESE_ZCOOL.className),
								}
							}}></Toaster>
							<PWAPrompt copyTitle='将 Leximory 添加到主屏幕' copyDescription='在主屏幕上快速访问 Leximory PWA' copySubtitle='https://leximory.com/' copyShareStep='点击右上角分享按钮' copyAddToHomeScreenStep='点击“添加到主屏幕”' appIconPath='/apple-touch-icon.png' />
							{children}
						</RenderingBoundary>
					</JotaiProvider>
				</ThemeProvider>
			</NextUIProvider>
		</ClerkProvider>
	)
}
