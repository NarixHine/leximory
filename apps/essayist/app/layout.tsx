import type { Metadata } from 'next'
import { Newsreader, Space_Mono } from 'next/font/google'
import localFont from 'next/font/local'
import './globals.css'
import Providers from './providers'

const APP_NAME = 'Essayist'
const APP_DEFAULT_TITLE = 'Essayist'
const APP_TITLE_TEMPLATE = '%s | Essayist'

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: APP_DEFAULT_TITLE,
    template: APP_TITLE_TEMPLATE,
  },
  formatDetection: {
    telephone: false,
  },
}

const english = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
})

const chinese = localFont({
  src: './chinese-serif.woff2',
  display: 'swap',
})

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang='en'>
      <body className={'subpixel-antialiased'} style={{ fontFamily: `${english.style.fontFamily}, ${chinese.style.fontFamily}, monospace` }}>
        <Providers themeProps={{ enableSystem: true, attribute: 'class' }}>
          {children}
        </Providers>
      </body>
    </html>
  )
}
