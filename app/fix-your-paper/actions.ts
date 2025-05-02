'use server'

import { type CoreMessage, generateText } from 'ai'
import { googleModels } from '@/lib/config'
import incrCommentaryQuota from '@/server/auth/quota'

const model = googleModels['pro-2.5']

const SYSTEM_PROMPT = `
你是上海英语高考审题人，你将会看到一张初步创作完成的试卷，你需要评估其中的除听力（Listening Comprehension）外的**客观题**（含语法填空至六选四）中题目的正确性和合理性。

首先，你需要忽略答案，自行完成所有题目的作答。直接给出答案。

# 输出格式

对每道在上述范围内的题，依次输出：

> **大题名称** 题号：答案。题号：答案。……

对于填空题，答案写单词。

对于选择题，答案只写字母代号。

# 需要完成的题型及其规则

# 需要审核的题型

## 语法填空（Grammar & Vocabulary: Section A）

对于不给关键词的空格，考生需要填入适当的虚词（如介词、连词、冠词、代词等），**且每一小题含有1～3条横线，每横线都只填一词**（i.e. there may be multiple blanks for one question）。根据横线数量，每道题可以填入1～3个词，请仔细观察。此处不允许填入实词，亦**禁止填入副词（如even/only）**或表示完成时的have/has/had。

而对于在括号内给出关键词的空格，考生则需要填入所给关键词的适当形式，如形容词和副词的比较级和最高级，动词的各种时态、语态形式，非谓语形式等。

## 选词填空（Grammar & Vocabulary: Section B）

以语篇的形式呈现，设置10道空白处，要求考生从所提供的有11个单词构成的词库里选出最合适的词分别填入各空白处，使短文意思和结构完整。每个单词只能选一次，有1个单词为干扰项。

## 完形填空（Reading Comprehension: Section A）

在短文中删去原词，留出15个空格，不考核语法形式的区别。完形填空的四个备选答案，一般都属于同一词类，同一语义范畴。

## 阅读理解（Reading Comprehension: Section B）

包含三篇阅读文章，每篇文章下的题目都是四选一式的选择题。每篇设题数量为3~4题不等，但三篇总题数为11题。错误选项的常见设置方式有细节出入、逻辑错误、内容无关、以偏概全等，需要小心。

## 六选四（Reading Comprehension: Section C）

六选四即从六个句子中选取四个填入文中适当位置，具体呈现方式为：给出一篇缺少4个句子的语篇，对应有6个句子选项，其中2个为干扰项。`

const COMPARISON_PROMPT = `
接下来，你会看到本卷参考答案。请你与参考答案逐个比对自己的答案，观察是否与标准答案存在差异。据此来评判出题正确性。如果存在不一致答案的题目，再次进行判断是否存在歧义或出题不当。 

# 输出格式 

对于**最终**结论为有歧义或出题不当的题目，依次： 

1. 输出题号； 
2. 用中文给出修改建议；
3. 用中文解释原有参考答案的不合理或不自然处/未必一定填此答案的理由/存在其他合理答案的理由。

例如：

### 44

修改建议：

> ……

理由：

> 参考答案指出……
>
> ……

如果没有，直接输出：

\`\`\`
## No Issues Found

Your paper is already good to go!
\`\`\`
`

async function buildMessages(params: {
    paperFile: File,
} | {
    paperFile: File,
    answerFile: File,
    paperAnalysis: string
}): Promise<CoreMessage[]> {
    const { paperFile } = params
    const { paperAnalysis, answerFile } = 'paperAnalysis' in params ? params : { paperAnalysis: null, answerFile: null }

    const messages: CoreMessage[] = [{
        role: 'system',
        content: SYSTEM_PROMPT
    }, {
        role: 'user',
        content: [
            {
                type: 'text',
                text: '请分析以下试卷：'
            },
            {
                type: 'file',
                data: await paperFile.arrayBuffer(),
                mimeType: paperFile.type,
            },
        ],
    }]

    if (paperAnalysis) {
        messages.push({
            role: 'assistant',
            content: `我的答案：${paperAnalysis}`
        }, {
            role: 'user',
            content: [{
                type: 'text',
                text: COMPARISON_PROMPT
            }, {
                type: 'text',
                text: '拟定试卷参考答案：'
            }, {
                type: 'file',
                data: await answerFile!.arrayBuffer(),
                mimeType: answerFile!.type,
            }]
        })
    }

    return messages
}

export async function analyzePaper(paperFile: File) {
    if (await incrCommentaryQuota(2)) {
        return { error: '本月 AI 审题额度耗尽' }
    }

    const messages = await buildMessages({ paperFile })
    const paperAnalysis = await generateText({
        model,
        messages,
        temperature: 0.01,
        maxTokens: 20000
    })

    return { output: paperAnalysis.text }
}

export async function compareAnswers(paperFile: File, answerFile: File, paperAnalysis: string) {
    if (await incrCommentaryQuota(3)) {
        return { error: '本月 AI 审题额度耗尽' }
    }

    const messages = await buildMessages({ paperFile, answerFile, paperAnalysis })
    const comparison = await generateText({
        model,
        messages,
        temperature: 0.01,
        maxTokens: 20000
    })

    return { output: comparison.text }
}
