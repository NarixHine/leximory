import { authWriteToLib } from '@/lib/auth'
import { parseBody } from '@/lib/utils'
import { XataClient } from '@/lib/xata'
import { verifyToken } from '@clerk/nextjs/server'
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
    await authWriteToLib(lib, sub)
    await xata.db.lexicon.create({ lib, word })

    return NextResponse.json({ success: true })
}
