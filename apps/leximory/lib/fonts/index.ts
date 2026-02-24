import { Libre_Baskerville, Instrument_Serif, Source_Code_Pro, Raleway } from 'next/font/google'
import localFont from 'next/font/local'

export const MINCHO = localFont({
    src: './mincho.woff2',
    variable: '--font-mincho',
})

export const ENGLISH = Raleway({
    subsets: ['latin'],
    weight: 'variable',
    style: ['normal', 'italic'],
    variable: '--font-english',
})

export const ENGLISH_MONO = Source_Code_Pro({
    subsets: ['latin'],
    weight: ['400'],
    style: ['normal'],
    variable: '--font-english-mono',
})

export const ENGLISH_SERIF = Libre_Baskerville({
    subsets: ['latin'],
    weight: 'variable',
    style: ['italic', 'normal'],
    variable: '--font-english-serif',
})

export const ENGLISH_FANCY = Instrument_Serif({
    subsets: ['latin'],
    style: ['normal', 'italic'],
    weight: ['400'],
    variable: '--font-english-fancy',
})
