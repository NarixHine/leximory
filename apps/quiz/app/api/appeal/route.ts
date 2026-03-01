import { streamText, UIMessage } from 'ai'
import { FLASH_AI } from '@repo/service/ai/config'
import { z } from '@repo/schema'

const bodySchema = z.object({
    messages: z.array(z.any()),
    sectionType: z.string(),
    feedback: z.record(z.string(), z.unknown()),
})

export async function POST(req: Request) {
    const body = await req.json()
    const { success, data } = bodySchema.safeParse(body)
    if (!success) {
        return new Response('Invalid request body', { status: 400 })
    }
    const { messages, sectionType, feedback } = data

    const systemPrompt = `You are a fair and patient exam marker answering a student's appeal or question about their ${sectionType} exam marking result. 

Here is the marking feedback for context:
${JSON.stringify(feedback, null, 2)}

Answer the student's question concisely in Chinese. Explain why points were deducted and what the correct usage/answer would be. Be objective and educational. If the student's appeal has merit, acknowledge it honestly.`

    const result = streamText({
        ...FLASH_AI,
        system: systemPrompt,
        messages,
    })

    return result.toUIMessageStreamResponse()
}
