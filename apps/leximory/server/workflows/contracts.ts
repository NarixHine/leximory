import { z } from 'zod'

export const articleImportEventSchema = z
    .object({
        article: z.string().min(1).max(30000),
        textId: z.string().min(1).max(128),
        onlyComments: z.boolean(),
        userId: z.string().min(1).max(128),
        generateTitle: z.boolean().optional(),
        source: z.literal('ios').optional(),
    })
    .strict()

export const deletionPayload = z.object({ requestId: z.uuid() }).strict()
export const applePayload = z
    .object({ environment: z.enum(['Production', 'Sandbox']), chain: z.string().min(1) })
    .strict()
