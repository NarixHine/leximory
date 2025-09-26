'use server'

import { type ModelMessage, generateText } from 'ai'
import incrCommentaryQuota from '@/server/auth/quota'
import { ACTION_QUOTA_COST } from '@/lib/config'
import { thinkAI } from '@/server/ai/configs'

const SECTION_PROMPTS = {
    '语法填空（Grammar & Vocabulary: Section A）':
        `填空题：对于不给关键词的空格，考生需要填入适当的虚词（如介词、连词、冠词、代词等），**且每一小题含有1～3条横线，横线中间以空格分隔，每横线都只填一词**（i.e. there may be multiple blanks for one question）。根据横线数量，每道题可以填入1～3个词，请仔细观察。此处不允许填入实词，亦**禁止填入副词（如even/only/yet）**或表示完成时的have/has/had，但可以填even if/even though/have to。\n\n而对于在括号内给出关键词的空格，考生则需要填入所给关键词的适当形式，如形容词和副词的比较级和最高级，动词的各种时态、语态形式，非谓语形式等。`,
    '十一选十/选词（Grammar & Vocabulary: Section B）':
        `选择题：以语篇的形式呈现，设置10道空白处，要求考生从所提供的有11个单词构成的词库里选出最合适的词分别填入各空白处，使短文意思和结构完整。每个单词只能选一次，有1个单词为干扰项。`,
    '完形/Cloze（Reading Comprehension: Section A）':
        `选择题：在短文中删去原词，留出15个空格。每题有四个备选项，一般都属于同一词类。`,
    '阅读理解（Reading Comprehension: Section B）':
        `选择题：包含三篇阅读文章，每篇文章下的题目都是四选一式的选择题。每篇设题数量为3~4题不等，但三篇总题数为11题。错误选项的常见设置方式有细节出入、逻辑错误、内容无关、以偏概全等，需要小心。`,
    '六选四（Reading Comprehension: Section C）':
        `选择题：六选四即从六个句子中选取四个填入文中适当位置，具体呈现方式为：给出一篇缺少4个句子的语篇，对应有6个句子选项，其中2个为干扰项。`
} as const

const SYSTEM_PROMPT = `
你是上海英语高考审题人，你将会看到一张初步创作完成的试卷，你需要评估其中的除听力（Listening Comprehension）外的**客观题**（含语法填空至六选四）中题目的合理性。

首先，你需要自行完成以下大题的作答。直接给出答案。

# 输出格式

对每道在上述范围内的题，依次输出：

> 题号: 答案. 题号: 答案. ……

对于填空题，答案写单词。对于选择题，答案只写字母代号。不要在开头输出其他多余内容。
` as const

const COMPARISON_PROMPT = `
接下来，你会看到本卷参考答案。请你与参考答案逐个比对自己的答案，观察是否与标准答案存在差异。据此来评判出题正确性。如果存在不一致答案的题目，再次进行判断是否存在歧义或出题不当。 

# 输出格式 

对于**最终**结论为有歧义或出题不当的题目，直接依次： 

1. 输出题号； 
2. 用中文给出修改建议；
3. 用中文解释原有参考答案的不合理或不自然处/未必一定填此答案的理由/存在其他合理答案的理由。

在解释时，使用Markdown语法来清晰输出你的观点。你可以使用反引号（Markdown行内代码语法）而非括号来包裹选项，尽可能使用\*（Markdown斜体语法）替代引号，起到包裹原文、表示引用等作用。禁止使用代码块语法（三个反引号）。

例如：

\`\`\`
### 44

### 修改建议

> ……

### 理由

> 参考答案指出……
>
> ……
\`\`\`

如果没有，直接输出：

\`\`\`
## No Issues Found

> Your paper is already good to go!
\`\`\`

严格遵循上述格式输出。
` as const

async function buildMessages(params: {
    paperFile: File,
} | {
    paperFile: File,
    answerFile: File,
    paperAnalysis: string
}): Promise<ModelMessage[]> {
    const { paperFile } = params
    const { paperAnalysis, answerFile } = 'paperAnalysis' in params ? params : { paperAnalysis: null, answerFile: null }

    const messages: ModelMessage[] = [{
        role: 'system',
        content: `${SYSTEM_PROMPT}\n\n## 各大题规则\n\n${Object.keys(SECTION_PROMPTS).map(section => `### ${section}\n\n${SECTION_PROMPTS[section as keyof typeof SECTION_PROMPTS]}`).join('\n\n')}`
    }, {
        role: 'user',
        content: [
            {
                type: 'text',
                text: '请分析以下试卷。'
            },
            {
                type: 'file',
                data: await paperFile.arrayBuffer(),
                mediaType: paperFile.type
            }
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
                data: await answerFile.arrayBuffer(),
                mediaType: answerFile.type
            }]
        })
    }

    return messages
}

const ANALYZE_PAPER_COST = 3
export async function analyzePaper(paperFile: File, useFallbackModel = false) {
    if (await incrCommentaryQuota(ANALYZE_PAPER_COST)) {
        return { error: '本月 AI 审题额度耗尽' }
    }

    const messages = await buildMessages({ paperFile })
    const { text } = await generateText({
        messages,
        temperature: 0.01,
        maxOutputTokens: 20000,
        ...thinkAI
    })

    return { output: text }
}

export async function compareAnswers(paperFile: File, answerFile: File, paperAnalysis: string, useFallbackModel = false) {
    if (await incrCommentaryQuota(ACTION_QUOTA_COST.fixYourPaper - ANALYZE_PAPER_COST)) {
        return { error: '本月 AI 审题额度耗尽' }
    }

    const messages = await buildMessages({ paperFile, answerFile, paperAnalysis })
    const { text } = await generateText({
        messages,
        temperature: 0.01,
        maxOutputTokens: 20000,
        ...thinkAI
    })

    return { output: text }
}
