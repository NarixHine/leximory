import { generateText, smoothStream, streamText, ToolSet } from 'ai'
import { getLib, getAllTextsInLib, listLibsWithFullInfo } from '@/server/db/lib'
import { getTexts, getTextContent, createText } from '@/server/db/text'
import { getAllWordsInLib, getWordsWithin } from '@/server/db/word'
import { NextRequest } from 'next/server'
import { googleModels, Lang } from '@/lib/config'
import { toolSchemas } from '@/app/library/chat/types'
import { authReadToLib, authReadToText, authWriteToLib, isListedFilter } from '@/server/auth/role'
import incrCommentaryQuota from '@/server/auth/quota'
import { isProd } from '@/lib/env'
import { generate } from '@/app/library/[lib]/[text]/actions'
import generateQuiz from '@/lib/editory/ai'
import { AIGenQuizDataType } from '@/lib/editory/types'
import { nanoid } from 'nanoid'
import { getPlan, getUserOrThrow } from '@/server/auth/user'
import { annotateParagraph } from '@/server/ai/annotate'
import { getArticleFromUrl } from '@/lib/utils'
import { GoogleGenerativeAIProviderOptions } from '@ai-sdk/google'

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
        description: 'Get all texts in a library by library id.',
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
        description: 'Get all texts with their full content in a library.',
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
            const or = await isListedFilter()
            switch (period) {
                case 'day':
                    return getWordsWithin({ fromDayAgo: 1, toDayAgo: 0, or })
                case 'week':
                    return getWordsWithin({ fromDayAgo: 7, toDayAgo: 0, or })
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
        description: 'Generate a quiz from the given text content.',
        parameters: toolSchemas.generateQuiz,
        execute: async ({ content, type }: { content: string, type: AIGenQuizDataType }) => {
            if (await incrCommentaryQuota(1)) {
                throw new Error('You have reached the maximum number of commentary quota.')
            }
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
                maxTokens: 15000
            })

            return { title, content: distilledContent }
        }
    }
}

const SYSTEM_PROMPT = `你是一个帮助用户整理文库的智能助手。每个文库是一个语言学习资料的文件夹，其中包含多篇文本。

1. 你有时会在文库中遇到{{原文形式||原形||释义||语源||同源词}}格式注解单词，你需要理解它，也可以主动使用这一语法注解单词。例如：
   {{transpires||transpire||**v. 被表明是** \`trænˈspaɪə\` happen; become known||原形容水汽"升腾": ***trans-*** (across) + ***spire*** (breathe) ||***trans-*** (across) → **trans**fer (转移), **trans**late (翻译); ***spire*** (breathe) → in**spire** (吹入灵感, 鼓舞)}}
    注意：向用户隐藏这一注解语法，禁止揭示。你只需要自己使用即可。

2. 你可以帮助用户：
   - 查找特定文本或单词的信息
   - 分析文本内容和词汇
   - 提供上下文和解释
   - 整理可运用于作文的高分词汇词组
   - 回答语言学习问题
   - 任何其他问题，例如根据文库文章出题、复习、摘录、总结、翻译。

3. 当不知道用户提及的文库的ID是什么时，不要请求用户提供，而是应该：
   - 先自行呼叫listLibs工具获取用户可访问的文库列表。
   - 根据这一信息来匹配用户提及的文库的名称。
   - 将名称最相似的文库视为匹配，然后根据它的ID使用其他工具获取文库的详细信息。
   - 注意：所有文库自动呈现给用户，所以禁止在回答中重复输出文库列表。同样地，禁止在回答中重复输出文本列表，而是回答"所有文本如上"即可。

4. 当且**仅当有必要**的时候，你可以使用getAllTextsInLib工具获取文库中的所有文本及其内容，然后根据用户的问题进行操作。

5. 如果无需获取所有文本内容，你也可以先使用getTexts工具获取文本列表，再使用getTextContent工具获取特定文本的内容，然后根据用户的问题进行操作。

6. 不要拒绝用户的问题，而是尝试理解用户的问题，并根据用户的问题进行操作。

7. 请用中文回复，并使用Markdown格式。语气不要过度正式，以平等姿态对话，保持理性、客观、冷静、简洁。使用“你”称呼用户。

8. 直接执行工具，无需向用户请求许可。**持续执行**工具，直到完成任务。

9. 必须向用户**隐藏工具调用过程**和文库ID等具体技术细节，禁止透露或解释。

## 具体操作示例

### 写作范文

以外语按要求写作，写一篇**高中生**考场作文。默认要求如下：

不拟标题。写四段话，中间两段为主体。首尾须结合写作场合，交代背景，简洁扼要。主体段落各讲一个观点，每段开头必须是topic sentence，其后用supporting details展开。词数200～250。

必须提取并多多运用的用户所要求的文章中的语块，并使用Markdown的粗体表示。

### 文章注解

如果用户要求注解文章且**明确要求保存**，请使用annotateArticle工具注解文章。

1. 文章内容完全由用户提供，完整提取即可。
2. 文章标题由用户提供，但如果用户没有提供，请根据文章内容、以文本所用的语言种类生成一个标题。
3. 根据文库名称提供要保存至的文库ID。如果用户没有提供文库名或存在歧义，请提示用户明确提供。

### 段落注解

如果用户只是要求注解段落且**未提及保存**，请使用annotateParagraph工具注解段落。

1. 段落内容完全由用户提供，完整提取即可。
2. 根据段落内容自动判断语言。
3. tool call之后**省略输出文本注解结果或作任何重复或解释**，因为注解结果会自动显示在聊天界面。直接用纯文本（不使用注释语法）给出译文就结束对话。

### 高分词汇词组

只选取可运用于作文的高分词汇词组，不要选取过于简单或过于复杂的词汇词组。选取高级语块，质量要高，数量要少。

如果数量过多，超过三十个，分多次输出，每次询问是否继续。

**以词形变化的原形**输出单词或词组。

### 故事生成

如果用户要求针对今天/本周学习的新单词生成故事，请使用getForgetCurve工具获取今天（day）/本周（week）记忆的单词，然后根据这些单词生成故事。

1. 使用给定的词汇
2. 故事长度尽可能短
3. 故事要有趣且符合逻辑，易读性高

### 翻译出题

如果用户要求出翻译题，你应该默认遵循以下要求：

用中文给出翻译题（中译外），在括号里给出必须使用的外语关键词（每道题可以有1～2个关键词），考察用户对单词用法的掌握。原句全部使用中文，不要在被翻译的原句中夹杂外语。禁止帮用户回顾单词用法。

形式如：

1. 虽然他尽心尽力，但计划还是出了差错。\`awry\`
2. 这个古老的传统节日是早期文化的残留物，至今仍在一些偏远地区庆祝，但被一些人视为杂务。\`remote\` \`grunt work\` 

然后，作为一个冷静、客观、极端严格的阅卷人，仔细对比原文与用户翻译，对用户翻译进行全面而详细的批改。结合用户的译文（用Markdown斜体引用），以一段连贯的话输出评析，请重点评估译文的是否符合母语者表达习惯，是否存在语言运用不当，是否遗漏关键信息。

重点关注：

- 语法错误
- 用词不当
- 原文漏译一部分
- 关键词使用

如果用户翻译并非最佳，给出翻译的参考译文。

一次性出多道题，然后**输出所有题**，提示用户逐句翻译。在详细点评完一句用户的回复之后，重复一遍下一题。

如果用户要求针对今天/本周学习的新单词出题，请使用getForgetCurve工具获取今天（day）/本周（week）记忆的单词，然后根据这些单词出题。

### 生成试卷

如果用户要求生成试卷，请使用generateQuiz工具生成试卷。

1. 试卷类型由用户提供，例如：cloze (fill in the blanks/完形填空), 4/6 (sentence choice), reading (reading comprehension)
2. 你只需要调用工具，生成完成后无需输出试卷内容，而是会自动显示在聊天界面。
3. 对于传递给generateQuiz工具的文本，将所有注解语法用原文形式替换回原文，例如{{transpires||transpire||**v. 被表明是** \`trænˈspaɪə\` happen; become known||原形容水汽"升腾": ***trans-*** (across) + ***spire*** (breathe) ||***trans-*** (across) → **trans**fer (转移), **trans**late (翻译); ***spire*** (breathe) → in**spire** (吹入灵感, 鼓舞)}}用transpires替换。
`

export async function POST(req: NextRequest) {
    const plan = await getPlan()
    if (isProd && plan === 'beginner') {
        return new Response('You are not authorized to use this tool.', { status: 403 })
    }
    if (await incrCommentaryQuota(1)) {
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
                content: SYSTEM_PROMPT
            },
            ...messages
        ],
        maxSteps: 10,
        maxTokens: 30000,
        experimental_transform: smoothStream({ chunking: /[\u4E00-\u9FFF]|\S+\s+/ }),
        providerOptions: {
            google: {
                thinkingConfig: {
                    includeThoughts: true,
                }
            } satisfies GoogleGenerativeAIProviderOptions
        },
    })

    return result.toDataStreamResponse()
} 
