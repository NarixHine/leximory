import { parseBody } from '@/lib/utils'
import { XataClient } from '@/lib/xata'
import { verifyToken } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const xata = new XataClient()
const schema = z.object({
    token: z.string(),
})

export async function POST(request: Request) {
    const { token } = await parseBody(request, schema)
    const { sub } = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY! })
    const libs = await xata.db.libraries.filter({ owner: sub }).getMany()

    return NextResponse.json(libs.map(lib => ({ id: lib.id, name: lib.name })))
}
