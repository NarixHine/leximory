import '@/styles/globals.css'
import type { Metadata, Viewport } from 'next'
import { Providers } from './providers'
import type { ReactNode } from 'react'
import Dock from './components/dock'
import env from '@repo/env'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/next'
import { MINCHO, ENGLISH, ENGLISH_FANCY, ENGLISH_MONO, ENGLISH_SERIF } from '@/lib/fonts'
import InstallLeximory from './install-leximory'

const TITLE_DEFAULT = 'Leximory'
const TITLE_TEMPLATE = `%s | ${TITLE_DEFAULT}`
const APP_DESCRIPTION = '从记忆到心会'

export const metadata: Metadata = {
	applicationName: TITLE_DEFAULT,
	metadataBase: new URL(env.NEXT_PUBLIC_LEXIMORY_URL),
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

export const viewport: Viewport = {
	themeColor: '#FFFCF0',
}

export default async function RootLayout({ children }: { children: ReactNode }) {
	const fontVariables = [
		ENGLISH.variable,
		MINCHO.variable,
		ENGLISH_MONO.variable,
		ENGLISH_SERIF.variable,
		ENGLISH_FANCY.variable,
	].join(' ')

	return (
		<html lang='zh-CN' className={`${fontVariables} subpixel-antialiased`}>
			<body className='font-ui'>
				<SpeedInsights />
				<Analytics />
				<Providers themeProps={{ enableSystem: true, attribute: 'class' }}>
					<div className='relative flex flex-col print:bg-white'>
						{children}
						<InstallLeximory />
						<Dock />
					</div>
				</Providers>
			</body>
		</html>
	)
}
