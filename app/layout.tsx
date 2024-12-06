import '@/styles/globals.css'
import type { Metadata, Viewport } from 'next'
import { Providers } from './providers'
import Navbar from '@/app/navbar'
import { defaultFontFamily } from '@/lib/fonts'
import { auth } from '@clerk/nextjs/server'
import Script from 'next/script'
import type { ReactNode } from 'react'
import Dock from './dock'

const TITLE_DEFAULT = 'Leximory'
const TITLE_TEMPLATE = `%s | ${TITLE_DEFAULT}`
const APP_DESCRIPTION = '从记忆到心会'

export const metadata: Metadata = {
	applicationName: TITLE_DEFAULT,
	metadataBase: new URL(process.env.NEXT_PUBLIC_URL!),
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

export default function RootLayout({
	children,
}: {
	children: ReactNode
}) {
	const { userId } = auth()
	return (
		<html lang='zh-CN'>
			{process.env.NODE_ENV === 'production' && <Script defer src='/stats/script.js' data-website-id='fd3e7b19-4579-4bb2-a355-b6f60faea9ed'></Script>}
			<body style={{
				fontFamily: defaultFontFamily,
			}}>
				<Providers themeProps={{ attribute: 'class', enableSystem: true }}>
					<div className='relative flex flex-col'>
						<Navbar userId={userId} />
						{children}
						<Dock />
					</div>
				</Providers>
			</body>
		</html>
	)
}
