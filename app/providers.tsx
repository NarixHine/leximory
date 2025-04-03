'use client'

import { HeroUIProvider } from "@heroui/system"
import { useRouter } from 'next/navigation'
import { ThemeProvider } from 'next-themes'
import { ReactNode, useEffect } from 'react'
import { ClerkProvider, useUser } from '@clerk/nextjs'
import { zhCN } from '@clerk/localizations'
import { useSystemColorMode } from 'react-use-system-color-mode'
import { dark } from '@clerk/themes'
import { Provider as JotaiProvider } from 'jotai'
import { Toaster } from 'sonner'
import { cn } from '@/lib/utils'
import { CHINESE_ZCOOL } from '@/lib/fonts'
import { ThemeProviderProps } from 'next-themes/dist/types'
import dynamic from 'next/dynamic'
import { useLogSnag } from '@logsnag/next'
import { isProd } from '@/lib/env'

const PWAPrompt = dynamic(() => import('react-ios-pwa-prompt'), { ssr: false })

export interface ProvidersProps {
	children: ReactNode
	themeProps?: ThemeProviderProps
}

export function Providers({ children, themeProps }: ProvidersProps) {
	const router = useRouter()
	const mode = useSystemColorMode()

	return (
		<ClerkProvider localization={zhCN} afterSignOutUrl={'/'} appearance={{
			baseTheme: mode === 'dark' ? dark : undefined,
			variables: {
				// Core Color Tokens
				colorPrimary: mode === 'dark' ? '#5A6F5A' : '#A0B998',
				colorDanger: mode === 'dark' ? '#7A4C4C' : '#C29994',
				colorSuccess: mode === 'dark' ? '#5A6F5A' : '#A0B998',
				colorWarning: mode === 'dark' ? '#7F7A4C' : '#CBC48B',
				colorNeutral: mode === 'dark' ? '#FFFFFF' : '#222222',

				// Text Colors
				colorText: mode === 'dark' ? '#FFFFFF' : '#222222',
				colorTextOnPrimaryBackground: '#FFFFFF', // Always white for strong contrast on primary backgrounds
				colorTextSecondary: mode === 'dark' ? '#E0E0E0' : '#3A3A3A',

				// Backgrounds
				colorBackground: mode === 'dark' ? '#1C1E1A' : '#F8F5ED',
				colorInputText: mode === 'dark' ? '#FFFFFF' : '#222222',
				colorInputBackground: mode === 'dark' ? '#2A2C28' : '#F8F5ED',

				// Misc
				colorShimmer: mode === 'dark' ? '#3A3A3A' : '#E0E0E0',

				fontFamily: CHINESE_ZCOOL.style.fontFamily,
			}
		}}>
			<HeroUIProvider navigate={router.push}>
				<ThemeProvider {...themeProps}>
					<JotaiProvider>
						<Toaster toastOptions={{
							classNames: {
								toast: cn('bg-primary-50 text-primary-900 dark:text-sky-100 dark:bg-primary-900 dark:border-0', CHINESE_ZCOOL.className),
							}
						}}></Toaster>
						<LogSnagInit />
						<PWAPrompt copyTitle='将 Leximory 添加到主屏幕' copyDescription='在主屏幕上快速访问 Leximory PWA' copySubtitle='https://leximory.com/' copyShareStep='点击右上角分享按钮' copyAddToHomeScreenStep='点击"添加到主屏幕"' appIconPath='/apple-touch-icon.png' />
						{children}
					</JotaiProvider>
				</ThemeProvider>
			</HeroUIProvider>
		</ClerkProvider>
	)
}

function LogSnagInit() {
	const { setUserId, identify, setDebug } = useLogSnag()
	const { user, isLoaded } = useUser()

	useEffect(() => {
		setDebug(!isProd)
		if (isLoaded && user) {
			const { id, emailAddresses, username } = user
			const email = emailAddresses[0].emailAddress
			setUserId(id)
			identify({
				user_id: id,
				properties: {
					email,
					name: username ?? email,
				}
			})
		}
	}, [isLoaded, user])
	return <></>
}
