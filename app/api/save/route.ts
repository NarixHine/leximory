import { authWriteToLib } from '@/lib/auth'
import { originals, validateOrThrow } from '@/lib/lang'
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
    const { lib, token, word: original } = await parseBody(request, schema)

    const word = `{{${lang === 'en' ? originals(word)[0] : word}}}`
    validateOrThrow(word)
    const { sub } = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY! })
    const { lang } = await authWriteToLib(lib, sub)
    await xata.db.lexicon.create({ lib, word })
    revalidatePath(`/library/${lib}/corpus`)

    return NextResponse.json({ success: true })
}
