import '@/styles/globals.css'
import { Metadata, Viewport } from 'next'
import { Providers } from './providers'
import Navbar from '@/app/navbar'
import { defaultFontFamily } from '@/lib/fonts'
import Footer from '@/app/footer'
import { auth } from '@clerk/nextjs/server'
import Script from 'next/script'
import { ReactNode } from 'react'

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
		statusBarStyle: 'default',
		title: TITLE_DEFAULT
	},
	manifest: '/manifest.json',
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
		<html lang='en'>
			{process.env.NODE_ENV === 'production' && <Script defer src='/stats/script.js' data-website-id='fd3e7b19-4579-4bb2-a355-b6f60faea9ed'></Script>}
			<body style={{
				fontFamily: defaultFontFamily,
			}}>
				<Providers themeProps={{ attribute: 'class', enableSystem: true }}>
					<div className='relative flex flex-col'>
						<Navbar userId={userId} />
						{children}
						<Footer />
					</div>
				</Providers>
			</body>
		</html>
	)
}
