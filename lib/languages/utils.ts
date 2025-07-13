import { Lang } from '../config'
import type { LanguageServerStrategy, LanguageStrategy } from './types'

export function createLanguageStrategy<T extends LanguageStrategy>(
  config: T & { type: Lang; name: string }
): T {
  const defaults = {
  }

  return { ...defaults, ...config } as T
}

export function createLanguageServerStrategy<T extends LanguageServerStrategy>(
  config: Partial<T> & { type: Lang }
): T {
  const defaults = {
    getAccentPrompt: async () => ''
  }

  return { ...defaults, ...config } as unknown as T
}
