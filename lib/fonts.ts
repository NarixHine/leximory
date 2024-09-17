import { Montserrat, Noto_Serif_SC, Lora, Ma_Shan_Zheng, ZCOOL_XiaoWei, Playfair_Display } from 'next/font/google'

export const chinese = Noto_Serif_SC({ subsets: ['latin'], weight: ['400', '700'] })
export const english = Montserrat({ subsets: ['latin', 'latin-ext'], weight: ['400', '700'] })
export const english_serif = Lora({ subsets: ['latin'], weight: ['400', '700'] })
export const chinese_calligraphy = Ma_Shan_Zheng({ subsets: ['latin'], weight: ['400'] })
export const chinese_kaishu = ZCOOL_XiaoWei({ subsets: ['latin'], weight: ['400'] })
export const english_heading = Playfair_Display({ subsets: ['latin'], weight: ['400', '700'] })

export const defaultFontFamily = [english.style.fontFamily, chinese.style.fontFamily].join(',')
export const postFontFamily = [english_serif.style.fontFamily, chinese.style.fontFamily].join(',')
export const hFontFamily = [english_heading.style.fontFamily, chinese_kaishu.style.fontFamily].join(',')
