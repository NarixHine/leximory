import { generateObject } from 'ai'
import { Lang } from '@repo/env/config'
import { z } from '@repo/schema'
import { miniAI } from './configs'
import { getReviewLanguageCopy } from '@/lib/review-language'
import { LEXIMORY_WORLD_VIEW, type ReviewConversationFeedback } from '@/lib/review'

const ReviewConversationEvaluationSchema = z.object({
    goodPairs: z.array(z.object({
        original: z.string(),
        note: z.string(),
    })),
    badPairs: z.array(z.object({
        original: z.string(),
        improved: z.string(),
    })),
    reply: z.string(),
})

export async function evaluateReviewConversation({
    prompt,
    submission,
    keywords,
    lang,
}: {
    prompt: string
    submission: string
    keywords: string[]
    lang: Lang
}): Promise<ReviewConversationFeedback & { reply: string }> {
    const reviewCopy = getReviewLanguageCopy(lang)

    const { object } = await generateObject({
        ...miniAI,
        schema: ReviewConversationEvaluationSchema,
        prompt: `<prompt>
<world>${LEXIMORY_WORLD_VIEW}</world>
<role>
你是猫忆世界里牵起心灵连结的语言桥梁，要帮助小黑猫更温柔、更准确地理解小白猫的话。
</role>

<task>
目标语言：${reviewCopy.targetLanguageName}
小黑猫的话：${prompt}
参考关键词：${keywords.join(', ')}
小白猫的回复：${submission}
</task>

<guidelines>
- 这不是考试、命题作文或评分场景，而是一场开放的交流。不要压制多样内容，也不要因为观点新奇就给出负面判断。
- 所有反馈都要简洁、具体、温和。
- \`goodPairs\` 截取小白猫原句中的精彩片段，突出其中自然、鲜活、贴切、动人的表达。
- \`badPairs\` 仅针对清晰度、语法或地道度上真正值得轻轻润色之处。
- 如果整体表达已经自然通顺，可以让 \`badPairs\` 为空。
- \`improved\` 需要给出更顺滑的表达，并附上简短中文说明。
- \`note\` 需要像小黑猫听到这句话后的轻声回应，用中文简短指出这段表达可爱、真诚、贴切或生动之处。
- \`reply\` 绝不能像老师、阅卷人、评审或纠错器。它必须就是小黑猫本人，用目标语言轻声回应刚刚读到的内容。
- \`reply\` 应短、柔和、温存，可在合适时带一点心动感。但是禁止出现“tell me more“性质的问题，因为流程已结束、用户无法回复。
</guidelines>
</prompt>`,
    })

    return object
}
