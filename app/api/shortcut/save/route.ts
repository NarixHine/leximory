import { generateSingleCommentFromShortcut } from '@/app/library/[lib]/[text]/actions'
import { originals, parseComment, removeRubyFurigana } from '@/lib/comment'
import { parseBody } from '@/lib/utils'
import { saveWord } from '@/server/db/word'
import { after, NextResponse } from 'next/server'
import removeMd from 'remove-markdown'
import { z } from 'zod'
import { generateText } from 'ai'
import { ACTION_QUOTA_COST, Lang, SUPPORTED_LANGS } from '@/lib/config'
import { getShadowLib } from '@/server/db/lib'
import incrCommentaryQuota, { maxCommentaryQuota } from '@/server/auth/quota'
import { verifyToken } from '@/server/db/token'
import { googleModels, noThinkingConfig } from '@/server/ai/models'

const schema = z.object({
    word: z.string(),
    token: z.string()
})

export async function POST(request: Request) {
    const { word: rawWord, token } = await parseBody(request, schema)
    const sub = await verifyToken(token)
    if (await incrCommentaryQuota(ACTION_QUOTA_COST.wordAnnotation, sub)) {
        return NextResponse.json({ error: `你已用完本月的 ${await maxCommentaryQuota()} 次 AI 注释生成额度。` })
    }

    const lang = await getWordLang(rawWord)
    const word = `<must>${lang === 'en' ? originals(rawWord)[0] : rawWord}</must>`
    const comment = await generateSingleCommentFromShortcut(word, lang, sub)
    if (typeof comment === 'object' && 'error' in comment) {
        throw new Error(comment.error)
    }

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
        model: googleModels['flash-2.5'],
        prompt: `请判断下述词汇最可能属于哪种语言，在${SUPPORTED_LANGS.filter(lang => lang !== 'nl' && lang !== 'zh').join('、')}中选择（只返回语言代码）：\n${word}`,
        maxTokens: 50,
        ...noThinkingConfig
    })
    const lang = z.enum(SUPPORTED_LANGS).parse(text.trim())
    return lang
}
