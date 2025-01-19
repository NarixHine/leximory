import { generateSingleCommentFromShortcut } from '@/app/library/[lib]/[text]/actions'
import { authWriteToLib } from '@/server/auth/role'
import env from '@/lib/env'
import { originals, validateOrThrow } from '@/lib/lang'
import { parseBody } from '@/lib/utils'
import { saveWord } from '@/server/db/word'
import { verifyToken } from '@clerk/nextjs/server'
import { after, NextResponse } from 'next/server'
import removeMd from 'remove-markdown'
import { z } from 'zod'

const schema = z.object({
    lib: z.string(),
    word: z.string(),
    token: z.string()
})

export async function POST(request: Request) {
    const { lib, token, word: rawWord } = await parseBody(request, schema)

    const { sub } = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY })
    const { lang } = await authWriteToLib(lib, sub)
    const word = `[[${lang === 'en' ? originals(rawWord)[0] : rawWord}]]`
    const comment = await generateSingleCommentFromShortcut(word, lang, sub)
    if (typeof comment === 'object' && 'error' in comment) {
        throw new Error(comment.error)
    }

    const portions = comment.replaceAll('{', '').replaceAll('}', '').split('||')
    after(async () => {
        const word = `{{${portions[1]}||${portions.slice(1).join('||')}}}`
        validateOrThrow(word)
        await saveWord({ lib, word })
    })

    const plainPortions = portions.map((md) => removeMd(md))
    return NextResponse.json({ word: plainPortions[1], def: plainPortions[2], etym: plainPortions[3] ?? '无', cognates: plainPortions[4] ?? '无' })
}
