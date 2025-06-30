import '@/styles/globals.css'
import type { Metadata, Viewport } from 'next'
import { Providers } from './providers'
import { ViewTransitions } from 'next-view-transitions'
import type { ReactNode } from 'react'
import Dock from './components/dock'
import env from '@/lib/env'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/next'
import { defaultFontFamily } from '@/lib/fonts'
import { isAtRead } from '@/lib/subapp'
import dynamic from 'next/dynamic'

const TITLE_DEFAULT = 'Leximory'
const TITLE_TEMPLATE = `%s | ${TITLE_DEFAULT}`
const APP_DESCRIPTION = '从记忆到心会'

export const experimental_ppr = true

export const metadata: Metadata = {
	applicationName: TITLE_DEFAULT,
	metadataBase: new URL(env.NEXT_PUBLIC_URL),
	title: {
		default: TITLE_DEFAULT,
		template: TITLE_TEMPLATE,
	},
	description: APP_DESCRIPTION,
	appleWebApp: {
		capable: true,
		statusBarStyle: 'black-translucent',
		title: TITLE_DEFAULT,
	},
	formatDetection: {
		telephone: false,
	},
	openGraph: {
		type: 'website',
		siteName: TITLE_DEFAULT,
		title: {
			default: TITLE_DEFAULT,
			template: TITLE_TEMPLATE,
		},
		description: APP_DESCRIPTION,
	},
}

export async function generateViewport(): Promise<Viewport> {
	return await isAtRead() ? {
		themeColor: '#FFFFFF',
	} : {
		themeColor: '#FFFCF0',
	}
}

const PWAPrompt = dynamic(() => import('react-ios-pwa-prompt'), { ssr: false })

export default async function RootLayout({ children }: { children: ReactNode }) {
	const hideIrrelevantElements = await isAtRead()
	return (
		<ViewTransitions>
			<html lang='zh-CN' className='antialiased'>
				<body style={{ fontFamily: defaultFontFamily }}>
					<SpeedInsights />
					<Analytics />
					<Providers themeProps={{ enableSystem: true, attribute: 'class' }}>
						<div className='relative flex flex-col print:bg-white'>
							{children}
							{!hideIrrelevantElements && <PWAPrompt copyTitle='将 Leximory 添加到主屏幕' copyDescription='在主屏幕上快速访问 Leximory PWA' copySubtitle='https://leximory.com/' copyShareStep='点击右上角分享按钮' copyAddToHomeScreenStep='点击"添加到主屏幕"' appIconPath='/apple-touch-icon.png' />}
							{!hideIrrelevantElements && <Dock />}
						</div>
					</Providers>
				</body>
			</html>
		</ViewTransitions>
	)
}
