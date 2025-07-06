import 'server-only'
import { Lang } from '../config'
import { getAccentPreference } from '@/server/db/preference'
import { ENGLISH_PROMPT } from './en.prompt'
import { NOT_LISTED_PROMPT } from './nl.prompt'
import { JAPANESE_PROMPT } from './ja.prompt'
import { CHINESE_PROMPT } from './zh.prompt'

export const accentPreferencePrompt = async ({ lang, userId }: { lang: Lang, userId: string }) => {
  if (lang !== 'en') {
    return ''
  }
  const accent = await getAccentPreference({ userId })
  return `用户偏好：${accent}。请使用${accent}拼写、发音和语汇。`
}

export const exampleSentencePrompt = (lang: Lang) => `必须在语境义部分以斜体附上该词的例句。形如${lang === 'en' ? 'word||original||meaning: *example sentence*||etymology||cognates。例如：transpires||transpire||**v. 被表明是** \`trænˈspaɪə\` happen; become known: *It later transpired that he was a spy.*||原形容水汽“升腾”: ***trans-*** (across) + ***spire*** (breathe) ||***trans-*** (across) → **trans**fer (转移), **trans**late (翻译); ***spire*** (breathe) → in**spire** (吹入灵感, 鼓舞)。' : ''}${lang === 'ja' ? '単語||原形||意味：*例文*||語源。例如：可哀想||可哀想||**［形動］（かわいそう／可怜）**気の毒である：*彼女は可哀想に見えた。*||**かわい**（可悲）＋**そう**（……的样子）' : ''}${lang === 'zh' ? '词语||词语||释义：*例文*' : ''}`

export const instruction: {
  [lang: string]: string
} = {
  nl: NOT_LISTED_PROMPT,
  en: ENGLISH_PROMPT,
  ja: JAPANESE_PROMPT,
  zh: CHINESE_PROMPT
}
