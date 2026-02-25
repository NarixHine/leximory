import { Lang } from '@repo/env/config'
import { createLanguageStrategy } from './utils'
import { commentSyntaxRegex } from '@repo/utils/comment'

export const englishStrategy = createLanguageStrategy({
    type: 'en',
    name: '英文',
    emoji: '🇬🇧',
    welcome: '{{Welcome!||welcome||Welcome to your new English library!}}',
    maxChunkSize: 5000,
    maxArticleLength: 30000,
    FormattedReadingTime: (text: string) => {
        const sanitizedText = text.replace(commentSyntaxRegex, (_, p1) => p1)
        const wordCount = sanitizedText.split(/\s+/).length
        return <span className='text-lg tracking-wide'>{wordCount} Words, {Math.ceil(wordCount / 120)}-Minute Read</span>
    },
    exampleSentencePrompt: '必须在语境义部分以斜体附上该词的例句。形如word||original||meaning: *example sentence*||etymology||cognates。例如：transpires||transpire||**v. 被表明是** `trænˈspaɪə` happen; become known: *It later transpired that he was a spy.*||原形容水汽“升腾”: ***trans-*** (across) + ***spire*** (breathe) ||***trans-*** (across) → **trans**fer (转移), **trans**late (翻译); ***spire*** (breathe) → in**spire** (吹入灵感, 鼓舞)。',
    dictionaryLink: (word: string) => `https://www.etymonline.com/word/${word}`
})

export const chineseStrategy = createLanguageStrategy({
    type: 'zh',
    name: '文言文',
    emoji: '🇨🇳',
    welcome: '{{欢迎！||欢迎||欢迎来到你的新文言文文库！}}',
    maxChunkSize: 700,
    maxArticleLength: 5000,
    exampleSentencePrompt: '必须在语境义部分以「」包裹附上含有该词的古汉语或古诗词**简短例句**（例句必须含有被注释的词，且例句中被注释词的义项必须与原文语境义相同），例句中该词以Markdown粗体表示。形如：词语||词语||释义「例句」',
    defineLabel: '注解',
    defineClassName: 'font-formal font-semibold',
    dictionaryLink: (word: string) => `https://www.zdic.net/hans/${word}`
})

export const japaneseStrategy = createLanguageStrategy({
    type: 'ja',
    name: '日文',
    emoji: '🇯🇵',
    welcome: '{{ようこそ！||ようこそ||新しい日本語ライブラリへようこそ！}}',
    maxChunkSize: 1000,
    maxArticleLength: 10000,
    exampleSentencePrompt: '必须在语境义部分以「」包裹附上该词的例句，例句中该词以粗体表示。形如単語||原形||意味：*例文*||語源。例如：可哀想||可哀想||**［形動］（かわいそう／可怜）**気の毒である。「彼女は**可哀想**に見えた。」||**かわい**（可悲）＋**そう**（……的样子）',
    isRTL: true,
    lineHeight: '1.7 !important',
    pageFormat: (page, total, chapter) => `${chapter ? chapter.concat(' ') : ''}${page}/${total} ページ目`,
    defineLabel: '調べる',
    defineClassName: 'font-ja',
    dictionaryLink: (word: string) => `https://jisho.org/search/${encodeURIComponent(word)}`
})

export const notListedStrategy = createLanguageStrategy({
    type: 'nl',
    name: '其他',
    emoji: '🌐',
    welcome: '{{Welcome!||welcome||Welcome to your new library!}}',
    maxChunkSize: 2000,
    maxArticleLength: 10000,
    exampleSentencePrompt: '',
})

const strategies = [englishStrategy, chineseStrategy, japaneseStrategy, notListedStrategy]

export function getLanguageStrategy(lang: Lang) {
    return strategies.find(s => s.type === lang) ?? notListedStrategy
}
