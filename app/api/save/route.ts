import { authWriteToLib } from '@/lib/auth'
import { originals } from '@/lib/lang'
import { parseBody } from '@/lib/utils'
import { XataClient } from '@/lib/xata'
import { verifyToken } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const xata = new XataClient()
const schema = z.object({
    lib: z.string(),
    word: z.string(),
    token: z.string()
})

export async function POST(request: Request) {
    const { lib, token, word } = await parseBody(request, schema)

    const { sub } = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY! })
    const { lang } = await authWriteToLib(lib, sub)
    const firstWord = word.split(/\s+/)[0].replace(/[^\p{L}\p{N}]/gu, '')
    await xata.db.lexicon.create({ lib, word: `{{${lang === 'en' ? originals(firstWord)[0] : firstWord}}}` })
    revalidatePath(`/library/${lib}/corpus`)

    return NextResponse.json({ success: true })
}
