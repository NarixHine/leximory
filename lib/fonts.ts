import { Noto_Serif_SC, Ma_Shan_Zheng, ZCOOL_XiaoWei, Playfair_Display, Montserrat, Libre_Baskerville } from 'next/font/google'

export const CHINESE = Noto_Serif_SC({ subsets: ['latin'], weight: 'variable' })
export const ENGLISH = Montserrat({ subsets: ['latin', 'latin-ext'], weight: 'variable' })
export const ENGLISH_SERIF = Libre_Baskerville({ subsets: ['latin'], weight: ['400', '700'] })
export const CHINESE_CALLIGRAPHY = Ma_Shan_Zheng({ subsets: ['latin'], weight: ['400'] })
export const CHINESE_ZCOOL = ZCOOL_XiaoWei({ subsets: ['latin'], weight: ['400'] })
export const ENGLISH_PLAYFAIR = Playfair_Display({ subsets: ['latin'], weight: ['400', '700'] })

export const defaultFontFamily = [ENGLISH.style.fontFamily, CHINESE.style.fontFamily].join(',')
export const postFontFamily = [ENGLISH_SERIF.style.fontFamily, CHINESE.style.fontFamily].join(',')
export const hFontFamily = [ENGLISH_PLAYFAIR.style.fontFamily, CHINESE_ZCOOL.style.fontFamily].join(',')
