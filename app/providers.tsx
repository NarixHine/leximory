'use client'

import { HeroUIProvider } from "@heroui/system"
import { useRouter } from 'next/navigation'
import { ThemeProvider } from 'next-themes'
import { ReactNode } from 'react'
import { Provider as JotaiProvider } from 'jotai'
import { Toaster } from 'sonner'
import { cn } from '@/lib/utils'
import { ThemeProviderProps } from 'next-themes/dist/types'
import dynamic from 'next/dynamic'
import { CHINESE } from "@/lib/fonts"

const PWAPrompt = dynamic(() => import('react-ios-pwa-prompt'), { ssr: false })

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
				<PWAPrompt copyTitle='将 Leximory 添加到主屏幕' copyDescription='在主屏幕上快速访问 Leximory PWA' copySubtitle='https://leximory.com/' copyShareStep='点击右上角分享按钮' copyAddToHomeScreenStep='点击"添加到主屏幕"' appIconPath='/apple-touch-icon.png' />
				{children}
			</JotaiProvider>
		</ThemeProvider>
	</HeroUIProvider>)
}
