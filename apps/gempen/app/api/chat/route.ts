import { createAgentUIStreamResponse, ToolLoopAgent } from 'ai'

const agent = new ToolLoopAgent({
    model: 'xai/grok-4.1-fast-non-reasoning',
    instructions:
        'You are an expert data analyst. You provide clear insights from complex data.',
})

export async function POST(request: Request) {
    const { messages } = await request.json()

    return createAgentUIStreamResponse({
        agent,
        uiMessages: messages,
    })
}
