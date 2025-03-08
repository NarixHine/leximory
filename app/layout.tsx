import '@/styles/globals.css'
import type { Metadata, Viewport } from 'next'
import { Providers } from './providers'
import { defaultFontFamily } from '@/lib/fonts'
import { ViewTransitions } from 'next-view-transitions'
import type { ReactNode } from 'react'
import Dock from './components/dock'
import env, { isProd } from '@/lib/env'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { LogSnagProvider } from '@logsnag/next'
import Script from 'next/script'

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

export const viewport: Viewport = {
	themeColor: '#FFFCF0',
}

export default async function RootLayout({ children }: { children: ReactNode }) {
	return (
		<ViewTransitions>
			<html suppressHydrationWarning lang='zh-CN' className='antialiased'>
				<head>
					<LogSnagProvider token={env.NEXT_PUBLIC_LOGSNAG_API_KEY} project={env.NEXT_PUBLIC_LOGSNAG_PROJECT} />
					{isProd && <Script defer strategy='lazyOnload' src='/stats/script.js' data-website-id='fd3e7b19-4579-4bb2-a355-b6f60faea9ed'></Script>}
				</head>
				<body style={{
					fontFamily: defaultFontFamily,
				}}>
					<SpeedInsights />
					<Providers themeProps={{ enableSystem: true, attribute: 'class' }}>
						<div className='relative flex flex-col'>
							{children}
							<Dock />
						</div>
					</Providers>
				</body>
			</html>
		</ViewTransitions>
	)
}
