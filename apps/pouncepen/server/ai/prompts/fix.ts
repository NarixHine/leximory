import { QuizData } from '@repo/schema/paper'
import { applyStrategy } from '@repo/ui/paper/utils'
import { SectionTypeSchema, SECTIONS } from './sections'

export function buildTestTakerPrompt({ questionGroup }: { questionGroup: QuizData }) {
    const parsedType = SectionTypeSchema.parse(questionGroup.type)
    return `
你是上海英语高考试测考生，你将会看到一张初步创作完成的试卷，你的目标是帮考试院评估其中的**客观题**中题目的合理性。目前，你需要完成第一步——自行作答。

# 大题类型: ${SECTIONS[parsedType].name}    

${SECTIONS[parsedType].description}

# 输出格式

对每道在上述范围内的题，依次输出：

题号: 答案. 题号: 答案. ……

对于填空题，答案写单词。对于选择题（所有选择题都是单选题），答案写字母代号和选项单词/句子。对于怀疑题目有严重错误或极度不确定正确答案，输出[答案不明]。若认为题目有误，在所有答案输出完毕后给出说明。

直接开始作答。

# 试卷内容

你需要自行完成以下大题的作答。直接给出答案。

${applyStrategy(questionGroup, (strategy, specificData) => {
        if (strategy.getLlmReadyText) {
            const { paper } = strategy.getLlmReadyText(specificData)
            return paper
        }
    })}
`.trim()
}

export function buildFeedbackPrompt({ questionGroup }: { questionGroup: QuizData }) {
    return `接下来，你会看到本卷参考答案。请你与参考答案逐个比对自己的答案，观察是否与标准答案存在差异。据此来评判出题正确性。如果存在不一致答案的题目，再次进行判断是否存在歧义或出题不当。 

# 参考答案

${applyStrategy(questionGroup, (strategy, specificData) => {
        if (strategy.getLlmReadyText) {
            const { key } = strategy.getLlmReadyText(specificData)
            return key
        }
    })}

# 输出格式 

对于**最终**结论为有歧义或出题不当的题目，直接依次： 

1. 输出题目标识（问题句/挖空的上下文）； 
2. 用中文向出题人给出修改建议（所有选择题都必须是单选题）；
3. 用中文解释原有参考答案的不合理或不自然处/未必一定填此答案的理由/存在其他合理答案的理由。

在解释时，使用Markdown语法来清晰、**精练简洁**地输出你的观点。你可以使用反引号（Markdown行内代码语法）而非括号来包裹选项，尽可能使用\*（Markdown斜体语法）替代引号，起到包裹原文、表示引用等作用。禁止使用代码块语法（三个反引号）。

例如：

\`\`\`
### What can you infer about it?（或：... is no end of ___ for why ...）

#### 修改建议

……

#### 理由

参考答案指出……

……
\`\`\`

如果没有，直接输出：

\`\`\`
This question group is already good to go!
\`\`\`

严格遵循上述格式输出。
`
}
