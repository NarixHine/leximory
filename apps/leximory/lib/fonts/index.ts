import { Libre_Baskerville, Source_Code_Pro, Raleway, EB_Garamond, DM_Sans, Noto_Emoji } from 'next/font/google'
import localFont from 'next/font/local'
import { GeistMono } from 'geist/font/mono'

export const MINCHO = localFont({
    src: './mincho.woff2',
    variable: '--font-mincho',
})

export const EMOJI = Noto_Emoji({
    weight: '400',
    preload: false,
})

export const KAITI = localFont({
    src: './kaiti.woff2',
    variable: '--font-kaiti',
    preload: false,
})

export const ENGLISH = Raleway({
    subsets: ['latin'],
    weight: 'variable',
    style: ['normal', 'italic'],
    variable: '--font-english',
})

export const ENGLISH_SANS = DM_Sans({
    subsets: ['latin'],
    weight: 'variable',
    style: ['normal', 'italic'],
    variable: '--font-english-sans',
    preload: false,
})

export const ENGLISH_MONO = GeistMono

export const ENGLISH_IPA = Source_Code_Pro({
    subsets: ['latin'],
    weight: ['400'],
    style: ['normal'],
    variable: '--font-english-ipa',
})

export const ENGLISH_SERIF = Libre_Baskerville({
    subsets: ['latin'],
    weight: 'variable',
    style: ['italic', 'normal'],
    variable: '--font-english-serif',
})

export const ENGLISH_FANCY = EB_Garamond({
    subsets: ['latin'],
    style: ['normal', 'italic'],
    weight: ['400'],
    variable: '--font-english-fancy',
})
