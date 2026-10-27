import 'server-only'
import { z } from 'zod'
import { redis } from '@repo/kv/redis'
import { checkedResponse } from './http'
import { mobileMutationID } from './vocabulary-save'

const pointerSchema = z.object({ path: z.string(), revision: z.string() }).strict()
export const outlinePointerKey = (textId: string, version: string) =>
    `mobile:pdf-outline:${mobileMutationID(textId, version)}`
export async function readPDFOutlinePointer(textId: string, version: string) {
    const value = await redis.get(outlinePointerKey(textId, version))
    return value ? checkedResponse(pointerSchema, value) : null
}
