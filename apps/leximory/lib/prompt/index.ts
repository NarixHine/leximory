import 'server-only'
import { EN_ANNOTATION_PROMPT } from '@repo/service/prompts'
import { Lang } from '@repo/env/config'
import { NOT_LISTED_PROMPT } from './nl.prompt'
import { JAPANESE_PROMPT } from './ja.prompt'
import { CHINESE_PROMPT } from './zh.prompt'
import { FRENCH_PROMPT } from './fr.prompt'

export const instruction: {
    [lang: string]: string
} = {
    nl: NOT_LISTED_PROMPT,
    en: EN_ANNOTATION_PROMPT,
    fr: FRENCH_PROMPT,
    ja: JAPANESE_PROMPT,
    zh: CHINESE_PROMPT,
}

/** Example that teaches the model to annotate a whole chunk, not just its head. */
const CHUNK_EXAMPLES: Partial<Record<Lang, string>> = {
    en: '（例如如果括号内为"wrap my head around"，则对"wrap one\'s head around"进行注解；如果是"dip suddenly down"，则对"dip down"进行注解）',
    fr: '（例如如果括号内为"se rendre compte"，则对"se rendre compte"整体进行注解；如果是"mettre en perspective"，则对"mettre en perspective"进行注解）',
    zh: '（例如对于"天子[[并命]]"，注释"并命"在古汉语中而非现代汉语中的意思）',
}

/** Which fields the word annotation has, per language. */
const WORD_FIELDS: Partial<Record<Lang, string>> = {
    en: '、语源、同源词',
    fr: '、语源、同源词',
    ja: '、语源（可选）',
}

/**
 * Word-path guide for English.
 *
 * `EN_ANNOTATION_PROMPT` is written for whole articles: its rules about Markdown/whitespace
 * preservation, LaTeX code blocks and even annotation distribution cannot apply when exactly one
 * marked chunk is being annotated, and they cost ~3.5k prompt tokens of prefill on every tap.
 * This shorter guide keeps the field spec and the lexical rules that matter, and judged at least
 * as well as the full guide (4.6 vs 4.1 overall, 0 vs 4 hallucination flags) at 81% fewer prompt
 * tokens. Other languages need their own validated trim before they get one.
 */
const WORD_GUIDE_EN = `# 核心指令

你将看到一个英文句子，句中只有一个加 <must></must> 的语块。你只需要为这一个语块生成注解。

- 若被标记的是常见搭配，注解整个搭配（如注解 on side 而非只注解 side）
- 释义必须贴合该语块在本句中的具体含义；多义词只注解语境义
- 例句必须自造，不得照抄原句
- 语源与同语根词必须真实可考；没有把握就留空该字段，严禁编造
- 禁止输出原句，禁止注解 <must> 以外的任何内容
- 若语块是常见词或泛指词（如 the South、the Administration），释义必须点明它在本句中的具体所指

## 输出格式

依次输出五个字段，用 || 分隔，全部写在一行，前后不要任何多余内容：

原文形式||屈折变化的原形||精简语境化释义||语源||同语根词

- 原文形式：与句中完全一致（不含标点）
- 原形：词典形，短语给出完整短语
- 精简语境化释义：**词性 中文释义** \`音标\` 英文释义: *自造例句*
- 语源：原义与构词，形如 语源“原义”: ***词素*** (义) + ***词素*** (义)
- 同语根词：形如 ***词素*** (义) → **派生词** (中文)；无则留空

## 示例

transpires||transpire||**v. 被表明是** \`trænˈspaɪə\` happen; become known: *It later transpired that he had left.*||语源“升腾”: ***trans-*** (across) + ***spire*** (breathe)||***trans-*** (across) → **trans**fer (转移); ***spire*** (breathe) → in**spire** (鼓舞)

bridge the gap||bridge the gap||**phr. 弥合差距** \`brɪdʒ ðə ɡæp\` reduce the difference between two things or groups: *The scholarship aims to bridge the gap between rich and poor schools.*||由“架桥”引申为“消除隔阂”: ***bridge*** (桥) + ***gap*** (缺口)||***bridge*** (桥) → **bridge**head (桥头堡)`

/**
 * Mobile definition path: the same trim, but the mobile client parses `{{原文形式||…}}`
 * (see `parseGeneratedDefinition`), so the format section and the examples use braces, the field
 * names are the mobile ones, and empty trailing fields are omitted rather than left blank.
 * Edited as a pair with WORD_GUIDE_EN: both describe one chunk, the output contract differs.
 */
const WORD_GUIDE_MOBILE_EN = `# 核心指令

你将看到一个英文句子，句中只有一个用 [[ ]] 标出的语块。你只需要为这一个语块生成注解。

- 若被标记的是常见搭配，注解整个搭配（如注解 on side 而非只注解 side）
- 释义必须贴合该语块在本句中的具体含义；多义词只注解语境义
- 例句必须自造，不得照抄原句
- 语源与同语根词必须真实可考；没有把握就留空该字段，严禁编造
- 禁止输出原句，禁止注解 [[ ]] 以外的任何内容
- 若语块是常见词或泛指词（如 the South、the Administration），释义必须点明它在本句中的具体所指

## 输出格式

只输出一行，整行用双花括号包住这个语块，字段之间用 || 分隔，前后不要任何多余内容：

{{原文形式||原形||语境释义||词源||同语根词}}

- 原文形式：与句中完全一致（不含标点）
- 原形：词典形，短语给出完整短语
- 语境释义：**词性 中文释义** \`音标\` 英文释义: *自造例句*
- 词源：原义与构词，形如 语源“原义”: ***词素*** (义) + ***词素*** (义)
- 同语根词：形如 ***词素*** (义) → **派生词** (中文)；没有词源或同源词时省略相应末尾字段，不要输出空字段

## 示例

{{transpires||transpire||**v. 被表明是** \`trænˈspaɪə\` happen; become known: *It later transpired that he had left.*||语源“升腾”: ***trans-*** (across) + ***spire*** (breathe)||***trans-*** (across) → **trans**fer (转移); ***spire*** (breathe) → in**spire** (鼓舞)}}

{{bridge the gap||bridge the gap||**phr. 弥合差距** \`brɪdʒ ðə ɡæp\` reduce the difference between two things or groups: *The scholarship aims to bridge the gap between rich and poor schools.*||由“架桥”引申为“消除隔阂”: ***bridge*** (桥) + ***gap*** (缺口)||***bridge*** (桥) → **bridge**head (桥头堡)}}`

/**
 * Guide for annotating one marked chunk. English uses the trimmed guide (see WORD_GUIDE_EN);
 * other languages still carry the article guide until a trim is judged for their field set.
 */
export const wordGuide = (lang: Lang) => (lang === 'en' ? WORD_GUIDE_EN : instruction[lang])

/** Guide for the mobile definition path: same trim, braced output contract. */
export const mobileWordGuide = (lang: Lang) =>
    lang === 'en' ? WORD_GUIDE_MOBILE_EN : instruction[lang]

/** System prompt for the single-chunk (tap-to-define) annotation path. */
export const wordAnnotationInstructions = (lang: Lang) => `
    生成词汇注解（形如<must>vocabulary</must>或[[vocabulary]]的、<must></must>或[[]]中的部分必须注解）。
    ${wordGuide(lang)}
    `

/** User message for the single-chunk path: a sentence holding exactly one marked chunk. */
export const wordAnnotationPrompt = ({
    lang,
    prompt,
    exampleSentencePrompt,
    accent,
}: {
    lang: Lang
    prompt: string
    exampleSentencePrompt: string
    accent: string
}) =>
    `下文中仅一个加<must>或双重中括号的语块，你仅需要对它**完整**注解${CHUNK_EXAMPLES[lang] ?? ''}。如果是长句而非词汇则必须完整翻译并解释。不要在最后加多余的||。请依次输出它的原文形式、屈折变化的原形、语境义（含例句）${WORD_FIELDS[lang] ?? ''}即可，但${exampleSentencePrompt}${accent}。截断并删去词汇的前后文。\n\n${prompt}`
