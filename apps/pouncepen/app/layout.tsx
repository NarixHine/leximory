import type { Metadata } from 'next'
import { Instrument_Serif, Newsreader, Rethink_Sans } from 'next/font/google'
import localFont from 'next/font/local'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: {
    default: 'PouncePen',
    template: '%s | PouncePen',
  }
}

const sans = Rethink_Sans({
  variable: '--font-sans',
  weight: 'variable',
  subsets: ['latin'],
})

const serif = Instrument_Serif({
  variable: '--font-formal',
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
})

const chinese = localFont({
  src: './chinese.woff2',
  variable: '--font-chinese',
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
        className={`${sans.variable} ${chinese.variable} ${serif.variable} antialiased font-ui`}
      >
        <Providers themeProps={{ attribute: 'class', enableSystem: true }}>
          {children}
        </Providers>
      </body>
    </html>
  )
}
