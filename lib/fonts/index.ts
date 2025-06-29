import { Ma_Shan_Zheng, Playfair_Display, Montserrat, Libre_Baskerville, Hina_Mincho, Outfit, Noto_Serif_SC } from 'next/font/google'

export const CHINESE = Noto_Serif_SC({
    subsets: ['latin'],
    weight: ['500', '700'],
    style: ['normal'],
    fallback: ['SimSun', 'Songti SC', 'serif'],
    display: 'swap',
})

export const CHINESE_CALLIGRAPHY = Ma_Shan_Zheng({
    subsets: ['latin'],
    weight: ['400'],
    fallback: ['cursive'],
    display: 'swap',
})

export const ENGLISH = Montserrat({
    subsets: ['latin'],
    weight: 'variable',
    style: ['italic', 'normal'],
    fallback: ['Arial', 'Helvetica', 'sans-serif'],
    display: 'swap',
})

export const ENGLISH_SERIF = Libre_Baskerville({
    subsets: ['latin'],
    weight: ['400', '700'],
    style: ['italic', 'normal'],
    fallback: ['New York', 'Athelas', 'serif'],
    display: 'swap',
})

export const ENGLISH_PLAYFAIR = Playfair_Display({
    subsets: ['latin'],
    weight: ['400', '700'],
    fallback: ['Georgia', 'Times New Roman', 'serif'],
    display: 'swap',
})

export const JAPANESE_MINCHO = Hina_Mincho({
    subsets: ['latin'],
    weight: ['400'],
    fallback: ['MS Mincho', 'Hiragino Mincho ProN', 'serif'],
    display: 'swap',
})

export const ENGLISH_MODERN = Outfit({
    subsets: ['latin'],
    weight: 'variable',
    fallback: ['Arial', 'Helvetica', 'sans-serif'],
    display: 'swap',
})

export const defaultFontFamily = [ENGLISH.style.fontFamily, CHINESE.style.fontFamily, JAPANESE_MINCHO.style.fontFamily, 'serif'].join(',')
export const contentFontFamily = [ENGLISH_SERIF.style.fontFamily, CHINESE.style.fontFamily, JAPANESE_MINCHO.style.fontFamily, 'serif'].join(',')
export const hFontFamily = [ENGLISH_PLAYFAIR.style.fontFamily, CHINESE.style.fontFamily, JAPANESE_MINCHO.style.fontFamily, 'serif'].join(',')
export const jpFontFamily = [ENGLISH_SERIF.style.fontFamily, JAPANESE_MINCHO.style.fontFamily, CHINESE.style.fontFamily, 'serif'].join(',')
