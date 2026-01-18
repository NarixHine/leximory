import z from 'zod'

export const AskResponseSchema = z.object({
    explanation: z.string(),
    highlights: z.array(z.string()).optional(),
})

export type AskResponse = z.infer<typeof AskResponseSchema>
