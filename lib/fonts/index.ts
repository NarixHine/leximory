import { Ma_Shan_Zheng, Playfair_Display, Montserrat, Libre_Baskerville, Hina_Mincho, Noto_Serif_SC } from 'next/font/google'

export const CHINESE = Noto_Serif_SC({
    subsets: ['latin'],
    weight: ['500', '600', '700'],
    style: ['normal'],
})

export const CHINESE_CALLIGRAPHY = Ma_Shan_Zheng({
    subsets: ['latin'],
    weight: ['400'],
})

export const ENGLISH = Montserrat({
    subsets: ['latin'],
    weight: 'variable',
    style: ['italic', 'normal'],
})

export const ENGLISH_SERIF = Libre_Baskerville({
    subsets: ['latin'],
    weight: ['400', '700'],
    style: ['italic', 'normal'],
})

export const ENGLISH_PLAYFAIR = Playfair_Display({
    subsets: ['latin'],
    weight: ['400', '700'],
})

export const JAPANESE_MINCHO = Hina_Mincho({
    subsets: ['latin'],
    weight: ['400'],
})

export const defaultFontFamily = [ENGLISH.style.fontFamily, CHINESE.style.fontFamily, JAPANESE_MINCHO.style.fontFamily, 'serif'].join(',')
export const contentFontFamily = [ENGLISH_SERIF.style.fontFamily, CHINESE.style.fontFamily, JAPANESE_MINCHO.style.fontFamily, 'serif'].join(',')
export const hFontFamily = [ENGLISH_PLAYFAIR.style.fontFamily, CHINESE.style.fontFamily, JAPANESE_MINCHO.style.fontFamily, 'serif'].join(',')
export const jpFontFamily = [ENGLISH_SERIF.style.fontFamily, JAPANESE_MINCHO.style.fontFamily, CHINESE.style.fontFamily, 'serif'].join(',')
