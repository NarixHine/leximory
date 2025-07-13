import { ENGLISH_SERIF } from '../fonts'
import { createLanguageStrategy } from './utils'

export const englishStrategy = createLanguageStrategy({
    type: 'en',
    name: '英文',
    welcome: '{{Welcome!||welcome||Welcome to your new English library!}}',
    maxChunkSize: 5000,
    maxArticleLength: 30000,
    FormattedReadingTime: (text: string) => {
        const wordCount = text.split(/\s+/).length
        return <span className={ENGLISH_SERIF.className}>{wordCount} words&nbsp;&nbsp;·&nbsp;&nbsp;{Math.ceil(wordCount / 120)}-min read</span>
    },
    exampleSentencePrompt: '必须在语境义部分以斜体附上该词的例句。形如word||original||meaning: *example sentence*||etymology||cognates。例如：transpires||transpire||**v. 被表明是** `trænˈspaɪə` happen; become known: *It later transpired that he was a spy.*||原形容水汽“升腾”: ***trans-*** (across) + ***spire*** (breathe) ||***trans-*** (across) → **trans**fer (转移), **trans**late (翻译); ***spire*** (breathe) → in**spire** (吹入灵感, 鼓舞)。',
})

export const chineseStrategy = createLanguageStrategy({
    type: 'zh',
    name: '文言文',
    welcome: '{{欢迎！||欢迎||欢迎来到你的新文言文文库！}}',
    maxChunkSize: 700,
    maxArticleLength: 5000,
    exampleSentencePrompt: '必须在语境义部分以「」包裹附上该词的同义项古汉语/古诗词例句。形如词语||词语||释义：「例文」'
})

export const japaneseStrategy = createLanguageStrategy({
    type: 'ja',
    name: '日文',
    welcome: '{{ようこそ！||ようこそ||新しい日本語ライブラリへようこそ！}}',
    maxChunkSize: 1000,
    maxArticleLength: 10000,
    exampleSentencePrompt: '必须在语境义部分以「」包裹附上该词的例句。形如単語||原形||意味：*例文*||語源。例如：可哀想||可哀想||**［形動］（かわいそう／可怜）**気の毒である：「彼女は可哀想に見えた。」||**かわい**（可悲）＋**そう**（……的样子）'
})

export const notListedStrategy = createLanguageStrategy({
    type: 'nl',
    name: '其他',
    welcome: '{{Welcome!||welcome||Welcome to your new library!}}',
    maxChunkSize: 2000,
    maxArticleLength: 10000,
    exampleSentencePrompt: ''
})
