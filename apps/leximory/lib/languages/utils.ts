import { Lang } from '@repo/env/config'
import type { LanguageServerStrategy, LanguageStrategy } from './types'

export function createLanguageStrategy(
  config: Partial<LanguageStrategy> & { type: Lang; name: string }
): LanguageStrategy {
  const defaults = {
    isRTL: false,
    lineHeight: '1.6 !important',
    pageFormat: (page: number, total: number, chapter?: string) => `At ${page}/${total} in ${chapter ?? 'Chapter'}`,
    proseClassName: 'prose-lg',
    defineLabel: 'Define',
    defineClassName: 'font-formal',
  }

  return { ...defaults, ...config } as LanguageStrategy
}

export function createLanguageServerStrategy(
  config: Partial<LanguageServerStrategy> & { type: Lang }
): LanguageServerStrategy {
  const defaults = {
    getAccentPrompt: async () => '',
  }

  return { ...defaults, ...config } as LanguageServerStrategy
}
