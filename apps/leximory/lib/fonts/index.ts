import { Ma_Shan_Zheng, Montserrat, Libre_Baskerville, Hina_Mincho, Noto_Serif_SC, Instrument_Serif, Source_Code_Pro } from 'next/font/google'

export const CHINESE = Noto_Serif_SC({
    subsets: ['latin'],
    weight: ['500', '600', '700'],
    variable: '--font-chinese',
})

export const CHINESE_CALLIGRAPHY = Ma_Shan_Zheng({
    subsets: ['latin'],
    weight: ['400'],
    variable: '--font-chinese-calligraphy',
})

export const ENGLISH = Montserrat({
    subsets: ['latin'],
    weight: 'variable',
    style: ['italic', 'normal'],
    variable: '--font-english',
})

export const ENGLISH_MONO = Source_Code_Pro({
    subsets: ['latin'],
    weight: ['400'],
    style: ['normal', 'italic'],
    variable: '--font-english-mono',
})

export const ENGLISH_SERIF = Libre_Baskerville({
    subsets: ['latin'],
    weight: ['400', '700'],
    style: ['italic', 'normal'],
    variable: '--font-english-serif',
})

export const ENGLISH_FANCY = Instrument_Serif({
    subsets: ['latin'],
    style: ['normal', 'italic'],
    weight: ['400'],
    variable: '--font-english-fancy',
})

export const JAPANESE_MINCHO = Hina_Mincho({
    subsets: ['latin'],
    weight: ['400'],
    variable: '--font-japanese-mincho',
})

