import '@/styles/globals.css'
import type { Metadata, Viewport } from 'next'
import { Providers } from './providers'
import { ViewTransitions } from 'next-view-transitions'
import type { ReactNode } from 'react'
import Dock from './components/dock'
import env, { IS_PROD } from '@/lib/env'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/next'
import { CHINESE, ENGLISH, ENGLISH_FANCY, ENGLISH_MONO, ENGLISH_SERIF, JAPANESE_MINCHO } from '@/lib/fonts'
import { isAtRead } from '@/lib/subapp'
import InstallLeximory from './install-leximory'
import { AIDevtools } from '@ai-sdk-tools/devtools'

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

export default async function RootLayout({ children }: { children: ReactNode }) {
	const hideIrrelevantElements = await isAtRead()
	const fontVariables = [
		ENGLISH.variable,
		CHINESE.variable,
		JAPANESE_MINCHO.variable,
		ENGLISH_MONO.variable,
		ENGLISH_SERIF.variable,
		ENGLISH_FANCY.variable,
	].join(' ')

	return (
		<ViewTransitions>
			<html lang='zh-CN' className={`${fontVariables} subpixel-antialiased`}>
				<body className='font-ui'>
					<SpeedInsights />
					<Analytics />
					{!IS_PROD && <AIDevtools />}
					<Providers themeProps={{ enableSystem: true, attribute: 'class' }}>
						<div className='relative flex flex-col print:bg-white'>
							{children}
							{!hideIrrelevantElements && <InstallLeximory />}
							{!hideIrrelevantElements && <Dock />}
						</div>
					</Providers>
				</body>
			</html>
		</ViewTransitions>
	)
}
