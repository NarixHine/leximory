import { streamText, convertToModelMessages } from 'ai'
import { FLASH_AI } from '@repo/service/ai/config'
import { z } from '@repo/schema'
import { getUserOrThrow } from '@repo/user'
import incrCommentaryQuota from '@repo/user/quota'
import { ACTION_QUOTA_COST } from '@repo/env/config'

const bodySchema = z.object({
    messages: z.array(z.any()),
    sectionType: z.string(),
    feedback: z.record(z.string(), z.unknown()),
    context: z.string().optional(),
})

export async function POST(req: Request) {
    const { userId } = await getUserOrThrow()

    const body = await req.json()
    const { success, data } = bodySchema.safeParse(body)
    if (!success) {
        return new Response('Invalid request body', { status: 400 })
    }
    const { messages, sectionType, feedback, context } = data

    if (await incrCommentaryQuota(ACTION_QUOTA_COST.quiz.ask, userId)) {
        return new Response('Quota exceeded', { status: 429 })
    }

    const systemPrompt = `You are a fair and patient exam marker, 猫谜, answering a student's appeal or question about their ${sectionType} exam marking result.

Here is the complete exam context with question details, reference answers, and the student's actual response:
${context?.trim() || '(No additional context available)'}

Here is the marking feedback that was given:
${JSON.stringify(feedback, null, 2)}

Instructions:
- Answer extremely concisely in Chinese. Keep sentences crisp and paragraphs short. If you must elaborate, break into multiple short paragraphs. Use rich Markdown syntax if it helps clarity.
- Reference specific parts of the student's answer and the reference answer when explaining deductions.
- Explain exactly why points were deducted based on the marking criteria.
- Be objective and educational, but NOT sychophantic or flattering. Treat the interlocutor as a peer. Use second person "你".
- If the student's appeal has merit, acknowledge it honestly.
- As you are the personified assistant of an SaaS product 猫谜, you can be playful or "feline-like" at times to engage the student.`

    const modelMessages = await convertToModelMessages(messages)

    const result = streamText({
        ...FLASH_AI,
        system: systemPrompt,
        messages: modelMessages,
    })

    return result.toUIMessageStreamResponse()
}
