import { originals, parseComment, removeRubyFurigana } from '@/lib/comment'
import { parseBody } from '@/lib/utils'
import { saveWord } from '@/server/db/word'
import { after, NextResponse } from 'next/server'
import removeMd from 'remove-markdown'
import { z } from '@repo/schema'
import { generateText } from 'ai'
import { ACTION_QUOTA_COST, Lang, SUPPORTED_LANGS } from '@repo/env/config'
import { getShadowLib } from '@/server/db/lib'
import incrCommentaryQuota, { maxCommentaryQuota } from '@repo/user/quota'
import { verifyToken } from '@/server/db/token'
import { miniAI, nanoAI } from '@/server/ai/configs'
import { getLanguageStrategy } from '@/lib/languages'
import getLanguageServerStrategy from '@/lib/languages/strategies.server'
import { instruction } from '@/lib/prompt'

const schema = z.object({
    word: z.string(),
    token: z.string()
})

export async function POST(request: Request) {
    const { word: rawWord, token } = await parseBody(request, schema)
    const sub = await verifyToken(token)
    if (await incrCommentaryQuota(ACTION_QUOTA_COST.wordAnnotation, sub, true)) {
        return NextResponse.json({ error: `你已用完本月的 ${await maxCommentaryQuota()} 词点。` })
    }

    const lang = await getWordLang(rawWord)
    const word = `<must>${lang === 'en' ? originals(rawWord)[0] : rawWord}</must>`
    const comment = await generateSingleCommentFromShortcut(word, lang, sub)

    const portions = parseComment(comment)
    after(async () => {
        const word = `{{${portions[1]}||${portions.slice(1).join('||')}}}`
        const { id: lib } = await getShadowLib({ owner: sub, lang })
        await saveWord({ lib, word })
    })

    const plainPortions = portions.map((md) => removeMd(removeRubyFurigana(md)))
    return NextResponse.json({ word: plainPortions[1], def: plainPortions[2], etym: plainPortions[3] ?? '无', cognates: plainPortions[4] ?? '无' })
}

async function getWordLang(word: string): Promise<Lang> {
    const { text } = await generateText({
        prompt: `请判断下述词汇最可能属于哪种语言，在${SUPPORTED_LANGS.filter(lang => lang !== 'nl' && lang !== 'zh').join('、')}中选择（只返回语言代码）：\n${word}`,
        maxOutputTokens: 50,
        ...nanoAI
    })
    const lang = z.enum(SUPPORTED_LANGS).parse(text.trim())
    return lang
}

async function generateSingleCommentFromShortcut(prompt: string, lang: Lang, userId: string) {
    const { exampleSentencePrompt } = getLanguageStrategy(lang)
    const { getAccentPrompt } = getLanguageServerStrategy(lang)
    const { text } = await generateText({
        system: `
        生成词汇注解（形如<must>vocabulary</must>、<must></must>中的部分必须注解）。

        ${instruction[lang]}
        `,
        prompt: `下面是一个加<must>的语块，你仅需要对它**完整**注解${lang === 'en' ? '（例如如果括号内为“wrap my head around”，则对“wrap one\'s head around”进行注解；如果是“dip suddenly down"，则对“dip down”进行注解）' : ''}。如果是长句则完整翻译并解释。不要在输出中附带下文。请依次输出它的原文形式、原形、语境义（含例句）${lang === 'en' ? '、语源、同源词' : ''}${lang === 'ja' ? '、语源（可选）' : ''}即可，但${exampleSentencePrompt}${await getAccentPrompt(userId)}\n你要注解的是：\n${prompt}`,
        maxOutputTokens: 500,
        ...miniAI
    })

    return text
}
