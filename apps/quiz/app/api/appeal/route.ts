import { streamText, convertToModelMessages } from 'ai'
import { FLASH_AI } from '@repo/service/ai/config'
import { z } from '@repo/schema'

const bodySchema = z.object({
    messages: z.array(z.any()),
    sectionType: z.string(),
    feedback: z.record(z.string(), z.unknown()),
    context: z.string().optional(),
})

export async function POST(req: Request) {
    const body = await req.json()
    const { success, data } = bodySchema.safeParse(body)
    if (!success) {
        return new Response('Invalid request body', { status: 400 })
    }
    const { messages, sectionType, feedback, context } = data

    const systemPrompt = `You are a fair and patient exam marker answering a student's appeal or question about their ${sectionType} exam marking result.

Here is the complete exam context with question details, reference answers, and the student's actual response:
${context || '(No additional context available)'}

Here is the marking feedback that was given:
${JSON.stringify(feedback, null, 2)}

Instructions:
- Answer concisely in Chinese.
- Reference specific parts of the student's answer and the reference answer when explaining deductions.
- Explain exactly why points were deducted based on the marking criteria.
- Be objective and educational.
- If the student's appeal has merit, acknowledge it honestly.`

    const modelMessages = await convertToModelMessages(messages)

    const result = streamText({
        ...FLASH_AI,
        system: systemPrompt,
        messages: modelMessages,
    })

    return result.toUIMessageStreamResponse()
}
