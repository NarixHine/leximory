import type { Metadata } from 'next'
import { Instrument_Serif, Libre_Baskerville, Source_Code_Pro } from 'next/font/google'
import localFont from 'next/font/local'
import './globals.css'
import { Providers } from './providers'
import UserAvatar from '@repo/ui/user'
import { NavDock } from './components/nav-dock'

export const metadata: Metadata = {
  title: {
    default: '猫谜',
    template: '%s | 猫谜',
  }
}

export const ENGLISH_MONO = Source_Code_Pro({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-english-mono',
})

const ENGLISH_SERIF = Libre_Baskerville({
  variable: '--font-serif',
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
})

const CHINESE = localFont({
  src: './chinese.woff2',
  variable: '--font-chinese',
  display: 'swap',
})

const DISPLAY = localFont({
  src: './display.woff2',
  variable: '--font-display',
  display: 'swap',
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang='zh-CN' suppressHydrationWarning>
      <body
        className={`${CHINESE.variable} ${DISPLAY.variable} ${ENGLISH_SERIF.variable} ${ENGLISH_MONO.variable} antialiased font-ui`}
      >
        <Providers themeProps={{ attribute: 'class', enableSystem: true }}>
          {children}
          <div className='fixed top-3 right-3'>
            <UserAvatar />
          </div>
          <NavDock />
        </Providers>
      </body>
    </html>
  )
}
