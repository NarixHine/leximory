import { generateText, smoothStream, streamText, ToolSet } from 'ai'
import { getLib, getAllTextsInLib, listLibsWithFullInfo } from '@/server/db/lib'
import { getTexts, getTextContent, createText } from '@/server/db/text'
import { getAllWordsInLib, getWordsWithin } from '@/server/db/word'
import { NextRequest } from 'next/server'
import { googleModels } from '@/server/ai/models'
import { ACTION_QUOTA_COST, Lang } from '@/lib/config'
import { toolSchemas } from '@/app/library/chat/types'
import { authReadToLib, authReadToText, authWriteToLib, isListedFilter } from '@/server/auth/role'
import incrCommentaryQuota from '@/server/auth/quota'
import { isProd } from '@/lib/env'
import { generate } from '@/app/library/[lib]/[text]/actions'
import generateQuiz from '@/server/ai/editory'
import { nanoid } from 'nanoid'
import { getPlan, getUserOrThrow } from '@/server/auth/user'
import { annotateParagraph } from '@/server/ai/annotate'
import { getArticleFromUrl } from '@/lib/utils'
import { GoogleGenerativeAIProviderOptions } from '@ai-sdk/google'
import { AIGeneratableType } from '@/components/editory/generators/config'
import { getLatestTimesData, getTimesDataByDate } from '@/server/db/times'
import { momentSH } from '@/lib/moment'
import { CHAT_SYSTEM_PROMPT } from '@/lib/prompt'

const tools: ToolSet = {
    getLib: {
        description: 'Get details about a library by its id.',
        parameters: toolSchemas.getLib,
        execute: async ({ id }: { id: string }) => {
            await authReadToLib(id)
            return getLib({ id })
        }
    },
    getAllWordsInLib: {
        description: 'Get all words in a library by library id.',
        parameters: toolSchemas.getAllWordsInLib,
        execute: async ({ lib }: { lib: string }) => {
            await authReadToLib(lib)
            return getAllWordsInLib({ lib })
        }
    },
    getTexts: {
        description: 'Get all texts in a library by library id. Use this over getAllTextsInLib wherever possible.',
        parameters: toolSchemas.getTexts,
        execute: async ({ lib }: { lib: string }) => {
            await authReadToLib(lib)
            return getTexts({ lib })
        }
    },
    getTextContent: {
        description: 'Get the content and metadata of a text by its id.',
        parameters: toolSchemas.getTextContent,
        execute: async ({ id }: { id: string }) => {
            await authReadToText(id)
            const text = await getTextContent({ id })
            return text
        }
    },
    getAllTextsInLib: {
        description: 'Get all texts with their full content in a library. Use getTexts instead if you only need the list of texts.',
        parameters: toolSchemas.getAllTextsInLib,
        execute: async ({ libId }: { libId: string }) => {
            await authReadToLib(libId)
            return getAllTextsInLib({ libId })
        }
    },
    listLibs: {
        description: 'Get a list of all libraries accessible to the user. Do not repeat the list in your response. The count in the response is the number of saved words in the library.',
        parameters: toolSchemas.listLibs,
        execute: async () => {
            return listLibsWithFullInfo({ or: await isListedFilter() })
        }
    },
    getForgetCurve: {
        description: 'Get words that the user learned during a certain period of time.',
        parameters: toolSchemas.getForgetCurve,
        execute: async ({ period }: { period: 'day' | 'week' }) => {
            const { userId } = await getUserOrThrow()
            switch (period) {
                case 'day':
                    return getWordsWithin({ fromDayAgo: 1, toDayAgo: -1, userId })
                case 'week':
                    return getWordsWithin({ fromDayAgo: 7, toDayAgo: -1, userId })
            }
        }
    },
    annotateArticle: {
        description: 'Generate annotations for an article. The results will be available a few minutes after the text is created and returned.',
        parameters: toolSchemas.annotateArticle,
        execute: async ({ content, lib, title }: { content: string, lib: string, title: string }) => {
            await authWriteToLib(lib)
            const id = await createText({ lib, title, content })
            await generate({ article: content, textId: id, onlyComments: false })
            return { id, libId: lib, title, updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() }
        }
    },
    annotateParagraph: {
        description: 'Generate annotations for a short paragraph. This will not be saved. Results will be displayed in the chat interface instantly.',
        parameters: toolSchemas.annotateParagraph,
        execute: async ({ content, lang }: { content: string, lang: Lang }) => {
            const { userId } = await getUserOrThrow()
            return { annotation: await annotateParagraph({ content, lang, userId }), lang }
        }
    },
    generateQuiz: {
        description: 'Generate a quiz from the given text content. Available types: cloze (完形填空), reading (阅读理解), fishing (小猫钓鱼).',
        parameters: toolSchemas.generateQuiz,
        execute: async ({ content, type }: { content: string, type: AIGeneratableType }) => {
            const result = await generateQuiz({ prompt: content, type })
            return { ...result, type, id: nanoid() }
        }
    },
    extractArticleFromWebpage: {
        description: 'Extract the article from the given webpage. The results will be available in Markdown format.',
        parameters: toolSchemas.extractArticleFromWebpage,
        execute: async ({ url }: { url: string }) => {
            const { title, content } = await getArticleFromUrl(url)

            // Use AI to distill the main article content from the webpage
            const { text: distilledContent } = await generateText({
                model: googleModels['flash-2.5'],
                system: `You are an expert at extracting the main article content from webpage text. Your task is to:
1. Remove navigation elements, headers, footers, ads, and other non-article content
2. Keep only the main article body content
3. Preserve the article's structure and formatting, but remove the title and links
4. Return clean, readable article content in Markdown format
5. Remove any website-specific elements that are not part of the article itself`,
                prompt: `Please extract the main article content from this webpage text. Remove any navigation, ads, headers, footers, or other non-article elements. Return only the clean article content in Markdown format:

${content}`,
                maxTokens: 10000,
            })

            return { title, content: distilledContent }
        }
    },
    getTodaysTimes: {
        description: 'Get today\'s issue of The Leximory Times newspaper.',
        parameters: toolSchemas.getTodaysTimes,
        execute: async () => {
            return getLatestTimesData()
        }
    },
    getTimesIssue: {
        description: 'Get a specific issue of The Leximory Times newspaper by date (YYYY-MM-DD).',
        parameters: toolSchemas.getTimesIssue,
        execute: async ({ date }: { date: string }) => {
            return getTimesDataByDate(momentSH(date).format('YYYY-MM-DD'))
        }
    },
    requestPublishStreakMemory: {
        description: "Presents the user's summary of what they learned today as a draft that they can publish.",
        parameters: toolSchemas.requestPublishStreakMemory,
        execute: async ({ content }: { content: string }) => {
            const { userId, username, image } = await getUserOrThrow()
            return {
                content,
                user: {
                    id: userId,
                    username: username,
                    avatar_url: image
                }
            }
        }
    }
}

export async function POST(req: NextRequest) {
    const plan = await getPlan()
    if (isProd && plan === 'beginner') {
        return new Response('You are not authorized to use this tool.', { status: 403 })
    }
    if (await incrCommentaryQuota(ACTION_QUOTA_COST.chat)) {
        return new Response('You have reached the maximum number of commentary quota.', { status: 403 })
    }

    const body = await req.json()
    const messages = body.messages

    const result = streamText({
        model: googleModels['flash-2.5'],
        tools,
        messages: [
            {
                role: 'system',
                content: CHAT_SYSTEM_PROMPT
            },
            ...messages
        ],
        maxSteps: 30,
        maxTokens: 30000,
        temperature: 0.3,
        experimental_transform: smoothStream({ chunking: /[\u4E00-\u9FFF]|\S+\s+/ }),
        providerOptions: {
            google: {
                thinkingConfig: {
                    includeThoughts: true,
                    thinkingBudget: 1024,
                }
            } satisfies GoogleGenerativeAIProviderOptions
        },
    })

    return result.toDataStreamResponse()
} 
