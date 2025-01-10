import '@/styles/globals.css'
import type { Metadata, Viewport } from 'next'
import { Providers } from './providers'
import { defaultFontFamily } from '@/lib/fonts'
import Script from 'next/script'
import { ViewTransitions } from 'next-view-transitions'
import type { ReactNode } from 'react'
import Dock from './components/dock'
import env, { isProd } from '@/lib/env'

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
	themeColor: '#FAFDF6',
}

export default async function RootLayout(
	{
		children,
	}: {
		children: ReactNode
	}
) {
	return (
		<ViewTransitions>
			<html lang='zh-CN' className='antialiased'>
				{isProd && <Script defer src='/stats/script.js' data-website-id='fd3e7b19-4579-4bb2-a355-b6f60faea9ed'></Script>}
				<body style={{
					fontFamily: defaultFontFamily,
				}}>
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
