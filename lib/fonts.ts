import { Montserrat, Noto_Serif_SC, Lora, Ma_Shan_Zheng, ZCOOL_XiaoWei, Playfair_Display } from 'next/font/google'

export const zh = Noto_Serif_SC({ subsets: ['latin'], weight: ['400', '700'] })
export const en = Montserrat({ subsets: ['latin', 'latin-ext'], weight: ['400', '700'] })
export const lora = Lora({ subsets: ['latin'], weight: ['400', '700'] })
export const ma = Ma_Shan_Zheng({ subsets: ['latin'], weight: ['400'] })
export const xw = ZCOOL_XiaoWei({ subsets: ['latin'], weight: ['400'] })
export const playfair = Playfair_Display({ subsets: ['latin'], weight: ['400', '700'] })

export const defaultFontFamily = [en.style.fontFamily, zh.style.fontFamily].join(',')
export const postFontFamily = [lora.style.fontFamily, zh.style.fontFamily].join(',')
export const hFontFamily = [playfair.style.fontFamily, xw.style.fontFamily].join(',')
