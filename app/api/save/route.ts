import { generateSingleCommentFromShortcut } from '@/app/library/[lib]/[text]/actions'
import env from '@/lib/env'
import { originals, validateOrThrow } from '@/lib/lang'
import { parseBody } from '@/lib/utils'
import { saveWord } from '@/server/db/word'
import { verifyToken } from '@clerk/nextjs/server'
import { after, NextResponse } from 'next/server'
import removeMd from 'remove-markdown'
import { z } from 'zod'
import { generateText } from 'ai'
import { Lang, supportedLangs, OpenAIModel } from '@/lib/config'
import { getShadowLib } from '@/server/db/lib'
import incrCommentaryQuota, { maxCommentaryQuota } from '@/server/auth/quota'

export const maxDuration = 30

const schema = z.object({
    word: z.string(),
    token: z.string()
})

export async function POST(request: Request) {
    const { token, word: rawWord } = await parseBody(request, schema)
    const { sub } = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY })
    if (await incrCommentaryQuota(0.25)) {
        return NextResponse.json({ error: `你已用完本月的 ${await maxCommentaryQuota()} 次 AI 注释生成额度。` })
    }

    const lang = await getWordLang(rawWord)
    const word = `[[${lang === 'en' ? originals(rawWord)[0] : rawWord}]]`
    const comment = await generateSingleCommentFromShortcut(word, lang, sub)
    if (typeof comment === 'object' && 'error' in comment) {
        throw new Error(comment.error)
    }

    const portions = comment.replaceAll('{', '').replaceAll('}', '').split('||')
    after(async () => {
        const word = `{{${portions[1]}||${portions.slice(1).join('||')}}}`
        validateOrThrow(word)
        const { id: lib } = await getShadowLib({ owner: sub })
        await saveWord({ lib, word })
    })

    const plainPortions = portions.map((md) => removeMd(md))
    return NextResponse.json({ word: plainPortions[1], def: plainPortions[2], etym: plainPortions[3] ?? '无', cognates: plainPortions[4] ?? '无' })
}

async function getWordLang(word: string): Promise<Lang> {
    const { text } = await generateText({
        model: OpenAIModel,
        prompt: `请判断双重方括号中的单词最可能属于哪种语言，在${supportedLangs.filter(lang => lang !== 'nl' && lang !== 'zh').join('、')}中选择（只返回语言代码）：\n${word}`,
        maxTokens: 50,
    })
    const lang = z.enum(supportedLangs).parse(text)
    return lang
}
