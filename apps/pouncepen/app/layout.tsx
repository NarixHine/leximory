import type { Metadata } from 'next'
import { Instrument_Serif, Rethink_Sans, Source_Code_Pro } from 'next/font/google'
import localFont from 'next/font/local'
import './globals.css'
import { Providers } from './providers'
import UserAvatar from '@repo/ui/user'
import { CostTable } from './components/cost-table'

export const metadata: Metadata = {
  title: {
    default: 'PouncePen',
    template: '%s | PouncePen',
  }
}

export const ENGLISH_MONO = Source_Code_Pro({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-english-mono',
})

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
        className={`${sans.variable} ${chinese.variable} ${serif.variable} ${ENGLISH_MONO.variable} antialiased font-ui`}
      >
        <Providers themeProps={{ attribute: 'class', enableSystem: true }}>
          {children}
          <div className='fixed top-3 right-3'>
            <UserAvatar quotaModalChildren={<CostTable />} />
          </div>
        </Providers>
      </body>
    </html>
  )
}
