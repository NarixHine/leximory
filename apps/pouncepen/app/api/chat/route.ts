import { toolSchemas } from '@/components/editory/panel/editor/chat/tool-types'
import { generateQuiz } from '@/server/ai/generate-quiz'
import { AgentPrompt } from '@/server/ai/prompts/agent'
import incrCommentaryQuota from '@repo/user/quota'
import { createAgentUIStreamResponse, ToolLoopAgent, tool } from 'ai'
import { extractArticleFromUrl } from '@repo/scrape'
import { ACTION_QUOTA_COST } from '@repo/env/config'
import { AIGeneratableType } from '@repo/ui/paper/utils'

export async function POST(request: Request) {
    const { messages, currentItems } = await request.json()
    if (await incrCommentaryQuota(ACTION_QUOTA_COST.pouncepen.agent, undefined, true)) {
        throw new Error('Quota exceeded')
    }

    const agent = new ToolLoopAgent({
        model: 'google/gemini-3-flash',
        instructions: AgentPrompt,
        tools: {
            getCurrentItems: tool({
                description: 'Get the current list of quiz items',
                inputSchema: toolSchemas.getCurrentItems,
                execute: async () => {
                    return currentItems
                }
            }),
            addQuizItem: tool({
                description: 'Add a new quiz item to the paper',
                inputSchema: toolSchemas.addQuizItem,
            }),
            removeQuizItem: tool({
                description: 'Remove a quiz item by its id',
                inputSchema: toolSchemas.removeQuizItem,
            }),
            updateQuizItem: tool({
                description: 'Update an existing quiz item',
                inputSchema: toolSchemas.updateQuizItem
            }),
            designQuestions: tool({
                description: 'Design questions based on the adapted text. ALWAYS CALL this tool to generate new questions, rather than directly do it as the main agent. Add special instructions ONLY WHEN the user provides them.',
                inputSchema: toolSchemas.designQuestionsInput,
                execute: async ({ adaptedText, type, specialInstructions }: { adaptedText: string, type: AIGeneratableType, specialInstructions?: string }) => {
                    const object = await generateQuiz({ prompt: adaptedText, type, specialInstructions })
                    return object
                }
            }),
            scrapeArticle: tool({
                description: 'Scrape an article from a URL',
                inputSchema: toolSchemas.scrapeArticle,
                execute: async ({ url }: { url: string }) => {
                    return extractArticleFromUrl(url)
                }
            }),
        },
    })

    return createAgentUIStreamResponse({
        agent,
        uiMessages: messages,
    })
}
