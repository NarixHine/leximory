import type { Metadata } from 'next'
import { Rethink_Sans } from 'next/font/google'
import localFont from 'next/font/local'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: {
    default: '秋实',
    template: '%s | 秋实',
  }
}

const sans = Rethink_Sans({
  variable: '--font-sans',
  weight: 'variable',
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
    <html lang='zh-CN'>
      <body
        className={`${sans.variable} ${chinese.variable} antialiased font-ui`}
      >
        <Providers themeProps={{ attribute: 'class', enableSystem: true }}>
          {children}
        </Providers>
      </body>
    </html>
  )
}
