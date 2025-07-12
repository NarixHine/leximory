import { Lang } from '../config'
import { LanguageStrategy } from './types'

export function createLanguageStrategy<T extends LanguageStrategy>(
  config: Partial<T> & { type: Lang; name: string }
): T {
  const defaults = {
  }

  return { ...defaults, ...config } as T
}
