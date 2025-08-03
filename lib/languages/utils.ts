import { Lang } from '../config'
import type { LanguageServerStrategy, LanguageStrategy } from './types'

export function createLanguageStrategy<T extends LanguageStrategy>(
  config: Partial<T> & { type: Lang; name: string }
): T {
  const defaults = {
    isRTL: false,
    lineHeight: '1.6 !important',
    pageFormat: (page: number, total: number) => `At ${page}/${total} in Chapter`,
    proseClassName: 'prose-lg',
  }

  return { ...defaults, ...config } as T
}

export function createLanguageServerStrategy<T extends LanguageServerStrategy>(
  config: Partial<T> & { type: Lang }
): T {
  const defaults = {
    getAccentPrompt: async () => '',
  }

  return { ...defaults, ...config } as unknown as T
}
