import { smoothStream, streamText } from 'ai'
import { EN_ANNOTATION_PROMPT } from '../prompts'
import { FLASH_AI } from '../config'
import { setAnnotationCache } from '@repo/kv'
import crypto from 'crypto'

export const hashPrompt = (text: string) => crypto.createHash('sha256').update(text).digest('hex')

export function annotateWord({ prompt }: { prompt: string }) {
    const { textStream } = streamText({
        system: `
            生成词汇注解（形如<must>vocabulary</must>或[[vocabulary]]的、<must></must>或[[]]中的部分必须注解）。
            ${EN_ANNOTATION_PROMPT}
            `,
        prompt: `下文中仅一个加<must>或双重中括号的语块，你仅需要对它**完整**注解$（例如如果括号内为“wrap my head around”，则对“wrap one\'s head around”进行注解；如果是“dip suddenly down"，则对“dip down”进行注解）。如果是长句而非词汇则必须完整翻译并解释。不要在最后加多余的||。请依次输出它的原文形式、屈折变化的原形、语境义（含例句）、语源、同源词即可，但必须在语境义部分以斜体附上该词的例句。形如word||original||meaning: *example sentence*||etymology||cognates。例如：transpires||transpire||**v. 被表明是** \`trænˈspaɪə\` happen; become known: *It later transpired that he was a spy.*||原形容水汽“升腾”: ***trans-*** (across) + ***spire*** (breathe) ||***trans-*** (across) → **trans**fer (转移), **trans**late (翻译); ***spire*** (breathe) → in**spire** (吹入灵感, 鼓舞)。截断并删去词汇的前后文。\n\n${prompt}`,
        maxOutputTokens: 500,
        onFinish: async ({ text }) => {
            await setAnnotationCache({ hash: hashPrompt(prompt), cache: text })
        },
        onError: (err) => {
            console.error('Annotation error:', err)
        },
        experimental_transform: smoothStream({ chunking: /[\u4E00-\u9FFF]|\S+\s+/ }),
        ...FLASH_AI
    })

    return { annotation: textStream }
}
