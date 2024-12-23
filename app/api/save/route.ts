import { generateSingleCommentFromShortcut } from '@/app/library/[lib]/[text]/actions'
import { authWriteToLib } from '@/lib/auth'
import env from '@/lib/env'
import { originals, validateOrThrow } from '@/lib/lang'
import { parseBody, wrapInDoubleBracketsIfNot } from '@/lib/utils'
import { XataClient } from '@/lib/xata'
import { verifyToken } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { after, NextResponse } from 'next/server'
import removeMd from 'remove-markdown'
import { z } from 'zod'

const xata = new XataClient()
const schema = z.object({
    lib: z.string(),
    word: z.string(),
    token: z.string()
})

export async function POST(request: Request) {
    const { lib, token, word: rawWord } = await parseBody(request, schema)

    const { sub } = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY })
    const { lang } = await authWriteToLib(lib, sub)
    const word = `{{${lang === 'en' ? originals(rawWord)[0] : rawWord}}}`
    const comment = await generateSingleCommentFromShortcut(word, lang, sub)
    if (typeof comment === 'object' && 'error' in comment) {
        throw new Error(comment.error)
    }

    const wrappedComment = wrapInDoubleBracketsIfNot(comment)
    validateOrThrow(wrappedComment)
    after(async () => {
        await xata.db.lexicon.create({ lib, word: wrappedComment })
        revalidatePath(`/library/${lib}/corpus`)
    })
    
    const portions = wrappedComment.replaceAll('{{', '').replaceAll('}}', '').split('||').map((md) => removeMd(md))
    return NextResponse.json({ word: portions[1], def: portions[2], etym: portions[3] ?? '无', cognates: portions[4] ?? '无' })
}
