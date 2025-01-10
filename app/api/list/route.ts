import env from '@/lib/env'
import { parseBody } from '@/lib/utils'
import { listShortcutLibs } from '@/server/lib'
import { verifyToken } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
    token: z.string(),
})

export async function POST(request: Request) {
    const { token } = await parseBody(request, schema)
    const { sub } = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY })
    const libs = await listShortcutLibs({ owner: sub })

    return NextResponse.json(Object.fromEntries(libs.map(lib => [lib.name, lib.id])))
}
