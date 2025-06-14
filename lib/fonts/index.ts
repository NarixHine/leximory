import { Ma_Shan_Zheng, Playfair_Display, Montserrat, Libre_Baskerville, Hina_Mincho, Outfit } from 'next/font/google'
import localFont from 'next/font/local'

export const CHINESE = localFont({
    src: [{
        path: './mincho-r.ttf',
        weight: '400',
    }, {
        path: './mincho-b.ttf',
        weight: '700',
    }]
})
export const CHINESE_CALLIGRAPHY = Ma_Shan_Zheng({ subsets: ['latin'], weight: ['400'] })
export const ENGLISH = Montserrat({ subsets: ['latin'], weight: 'variable', style: ['italic', 'normal'] })
export const ENGLISH_SERIF = Libre_Baskerville({ subsets: ['latin'], weight: ['400', '700'], style: ['italic', 'normal'] })
export const ENGLISH_PLAYFAIR = Playfair_Display({ subsets: ['latin'], weight: ['400', '700'] })
export const JAPANESE_MINCHO = Hina_Mincho({ subsets: ['latin'], weight: ['400'] })
export const ENGLISH_MODERN = Outfit({ subsets: ['latin'], weight: 'variable' })
/*
export const CHINESE_CALLIGRAPHY = CHINESE
export const ENGLISH = CHINESE
export const ENGLISH_SERIF = CHINESE
export const ENGLISH_PLAYFAIR = CHINESE
export const JAPANESE_MINCHO = CHINESE
*/

export const defaultFontFamily = [ENGLISH.style.fontFamily, CHINESE.style.fontFamily, JAPANESE_MINCHO.style.fontFamily, 'serif'].join(',')
export const contentFontFamily = [ENGLISH_SERIF.style.fontFamily, CHINESE.style.fontFamily, JAPANESE_MINCHO.style.fontFamily, 'serif'].join(',')
export const hFontFamily = [ENGLISH_PLAYFAIR.style.fontFamily, CHINESE.style.fontFamily, JAPANESE_MINCHO.style.fontFamily, 'serif'].join(',')
