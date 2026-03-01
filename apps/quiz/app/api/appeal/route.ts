import { streamText } from 'ai'
import { FLASH_AI } from '@repo/service/ai/config'

export async function POST(req: Request) {
    const { messages, sectionType, feedback } = await req.json()

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
