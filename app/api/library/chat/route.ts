import { z } from 'zod'
import { streamText, ToolSet } from 'ai'
import { getLib, getAllTextsInLib, listLibsWithFullInfo } from '@/server/db/lib'
import { getTexts, getTextContent } from '@/server/db/text'
import { getAllWordsInLib, getForgetCurve } from '@/server/db/word'
import { NextRequest } from 'next/server'
import { googleModels } from '@/lib/config'
import { toolSchemas } from '@/app/library/chat/types'
import { forgetCurve } from '@/app/daily/components/report'
import { authReadToLib, authReadToText, getAuthOrThrow, isListed } from '@/server/auth/role'
import { getPlan } from '@/server/auth/quota'

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
        description: 'Get a list of all libraries accessible to the user.',
        parameters: toolSchemas.listLibs,
        execute: async () => {
            const { userId, orgId } = await getAuthOrThrow()
            return listLibsWithFullInfo({ owner: userId, orgId })
        }
    },
    getForgetCurve: {
        description: 'Get words that need review based on the forgetting curve.',
        parameters: z.object({
            day: z.enum(Object.keys(forgetCurve) as [keyof typeof forgetCurve]).describe('The time period to get words for'),
        }),
        execute: async ({ day }: { day: keyof typeof forgetCurve }) => {
            return await getForgetCurve({ day, filter: await isListed() })
        }
    }
}

const SYSTEM_PROMPT = `你是一个帮助用户管理图书馆的智能助手。你可以：

1. 你有时会在文库中遇到{{原文形式||原形||释义||语源||同源词}}格式注解单词，你需要理解它，也可以主动使用这一语法注解单词。例如：
   {{transpires||transpire||**v. 被表明是** \`trænˈspaɪə\` happen; become known||原形容水汽"升腾": ***trans-*** (across) + ***spire*** (breathe) ||***trans-*** (across) → **trans**fer (转移), **trans**late (翻译); ***spire*** (breathe) → in**spire** (吹入灵感, 鼓舞)}}

2. 帮助用户：
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

4. 当且**仅当有必要**的时候，你可以使用getAllTextsInLib工具获取文库中的所有文本及其内容，然后根据用户的问题进行操作。

5. 如果无需获取所有文本内容，你也可以先使用getTexts工具获取文本列表，再使用getTextContent工具获取特定文本的内容，然后根据用户的问题进行操作。

6. 不要拒绝用户的问题，而是尝试理解用户的问题，并根据用户的问题进行操作。

7. 请用中文回复，并使用 Markdown 格式。语气不要过度正式，请你保持简洁。

## 具体操作示例

### 高分词汇词组

只选取可运用于作文的高分词汇词组，不要选取过于简单或过于复杂的词汇词组。

### 作文

请根据用户的问题，生成一篇作文。

### 词组复习

`

export async function POST(req: NextRequest) {
    const plan = await getPlan()

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
        maxTokens: 20000,
        providerOptions: {
            google: {
                thinkingConfig: {
                    thinkingBudget: 0,
                }
            }
        }
    })

    return result.toDataStreamResponse()
} 
