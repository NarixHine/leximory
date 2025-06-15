import { contentFontFamily } from '@/lib/fonts'
import { atom } from 'jotai'

export const commentFontFamilyAtom = atom<string>(contentFontFamily)
