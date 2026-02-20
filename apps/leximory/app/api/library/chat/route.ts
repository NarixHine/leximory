import { convertToModelMessages, generateText, smoothStream, stepCountIs, streamText, ToolSet } from 'ai'
import { getLib, getAllTextsInLib, listLibsWithFullInfo } from '@/server/db/lib'
import { getTexts, getTextContent, createText, getTextWithLib } from '@/server/db/text'
import { getAllWordsInLib, getWordsWithin } from '@/server/db/word'
import { NextRequest } from 'next/server'
import { ACTION_QUOTA_COST, Lang } from '@repo/env/config'
import { toolSchemas } from '@/app/library/chat/types'
import { isListedFilter } from '@/server/auth/role'
import { Kilpi } from '@repo/service/kilpi'
import incrCommentaryQuota from '@repo/user/quota'
import { generate } from '@/app/library/[lib]/[text]/actions'
import { getUserOrThrow } from '@repo/user'
import { annotateParagraph } from '@/server/ai/annotate'
import { CHAT_SYSTEM_PROMPT } from '@/lib/prompt'
import { miniAI, nanoAI } from '@/server/ai/configs'
import { extractArticleFromUrl } from '@repo/scrape'

const tools: ToolSet = {
    getLib: {
        description: 'Get details about a library by its id.',
        inputSchema: toolSchemas.getLib,
        execute: async ({ id }: { id: string }) => {
            const libData = await getLib({ id })
            await Kilpi.libraries.read(libData).authorize().assert()
            return libData
        }
    },
    getAllWordsInLib: {
        description: 'Get all words in a library by library id.',
        inputSchema: toolSchemas.getAllWordsInLib,
        execute: async ({ lib }: { lib: string }) => {
            const libData = await getLib({ id: lib })
            await Kilpi.libraries.read(libData).authorize().assert()
            return getAllWordsInLib({ lib })
        }
    },
    getTexts: {
        description: 'Get all texts in a library by library id. Use this over getAllTextsInLib wherever possible.',
        inputSchema: toolSchemas.getTexts,
        execute: async ({ lib }: { lib: string }) => {
            const libData = await getLib({ id: lib })
            await Kilpi.libraries.read(libData).authorize().assert()
            return getTexts({ lib })
        }
    },
    getTextContent: {
        description: 'Get the content and metadata of a text by its id.',
        inputSchema: toolSchemas.getTextContent,
        execute: async ({ id }: { id: string }) => {
            const textWithLib = await getTextWithLib(id)
            await Kilpi.texts.read(textWithLib).authorize().assert()
            const text = await getTextContent({ id })
            return text
        }
    },
    getAllTextsInLib: {
        description: 'Get all texts with their full content in a library. Use getTexts instead if you only need the list of texts.',
        inputSchema: toolSchemas.getAllTextsInLib,
        execute: async ({ libId }: { libId: string }) => {
            const libData = await getLib({ id: libId })
            await Kilpi.libraries.read(libData).authorize().assert()
            return getAllTextsInLib({ libId })
        }
    },
    listLibs: {
        description: 'Get a list of all libraries accessible to the user. Do not repeat the list in your response. The count in the response is the number of saved words in the library.',
        inputSchema: toolSchemas.listLibs,
        execute: async () => {
            return listLibsWithFullInfo({ or: await isListedFilter() })
        }
    },
    getForgetCurve: {
        description: 'Get words that the user learned during a certain period of time.',
        inputSchema: toolSchemas.getForgetCurve,
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
        inputSchema: toolSchemas.annotateArticle,
        execute: async ({ content, lib, title }: { content: string, lib: string, title: string }) => {
            const libData = await getLib({ id: lib })
            await Kilpi.libraries.write(libData).authorize().assert()
            const id = await createText({ lib, title, content })
            await generate({ article: content, textId: id, onlyComments: false, delayRevalidate: true })
            return { id, libId: lib, title, updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() }
        }
    },
    annotateParagraph: {
        description: 'Generate annotations for a short paragraph. This will not be saved. Results will be displayed in the chat interface instantly.',
        inputSchema: toolSchemas.annotateParagraph,
        execute: async ({ content, lang }: { content: string, lang: Lang }) => {
            const { userId } = await getUserOrThrow()
            return { annotation: await annotateParagraph({ content, lang, userId }), lang }

        }
    },
    extractArticleFromWebpage: {
        description: 'Extract the article from the given webpage. The results will be available in Markdown format.',
        inputSchema: toolSchemas.extractArticleFromWebpage,
        execute: async ({ url }: { url: string }) => {
            const { title, content } = await extractArticleFromUrl(url)

            // Use AI to distill the main article content from the webpage
            const { text: distilledContent } = await generateText({
                system: `You are an expert at extracting the main article content from webpage text. Your task is to:
1. Remove navigation elements, headers, footers, ads, and other non-article content
2. Keep only the main article body content
3. Preserve the article's structure and formatting, but remove the title and links
4. Return clean, readable article content in Markdown format
5. Remove any website-specific elements that are not part of the article itself`,
                prompt: `Please extract the main article content from this webpage text. Remove any navigation, ads, headers, footers, or other non-article elements. Return only the clean article content in Markdown format:

${content}`,
                maxOutputTokens: 10000,
                ...nanoAI
            })

            return { title, content: distilledContent }
        }
    },
    requestPublishStreakMemory: {
        description: "Presents the user's summary of what they learned today as a draft that they can publish.",
        inputSchema: toolSchemas.requestPublishStreakMemory,
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
    if (await incrCommentaryQuota(ACTION_QUOTA_COST.chat, undefined, true)) {
        return new Response('You have reached the maximum number of commentary quota.', { status: 403 })
    }

    const body = await req.json()
    const messages = await convertToModelMessages(body.messages)

    const result = streamText({
        tools,
        system: CHAT_SYSTEM_PROMPT,
        messages,
        stopWhen: stepCountIs(20),
        maxOutputTokens: 30000,
        temperature: 0.3,
        experimental_transform: smoothStream({ chunking: /[\u4E00-\u9FFF]|\S+\s+/ }),
        ...miniAI
    })

    return result.toUIMessageStreamResponse()
} 
