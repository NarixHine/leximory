import 'server-only'
import { generateObject, type Experimental_EvaluationQuestion } from 'ai'
import { Lang } from '@repo/env/config'
import { LocationSchema, type LocationKind, type ResolvedLocation } from '@/lib/location'
import { locationAI } from './config'
import { EVALUATION_STATE_CONTENT_LIMIT, type EvaluationState } from './evaluate'

const LANG_NAME: Record<Lang, string> = {
    zh: '中文',
    en: 'English',
    fr: 'français',
    ja: '日本語',
    nl: 'Nederlands',
}

/**
 * One Jev call does both typed decisions: is there a mappable place, and which
 * kind is it? Runs in parallel with the vocabulary annotation, and hands the
 * resolver a kind prior so the (fast) model does less reasoning.
 */
export function locationDetection({ prompt }: { prompt: string }) {
    const state: EvaluationState = {
        text: prompt.slice(0, EVALUATION_STATE_CONTENT_LIMIT),
    }

    const questions = {
        hasLocation: {
            type: 'boolean',
            instructions:
                '判断给定文本是否指涉一个可以在地图上定位的具体地理实体（城市、国家、地区、山脉、海洋、湖泊、地标等）。必须能确定唯一实体及其今天的名称时才判定为 true；泛指（如"一座城市"）、比喻用法、纯虚构地名、或无法确定所指时判定为 false。',
            criteria: {
                true: '文本明确指涉可唯一确定的地理实体',
                false: '没有地理实体、泛指、虚构或无法唯一确定',
            },
        },
        kind: {
            type: 'choice',
            instructions:
                '若存在地理实体，选出最接近的类别；若不存在，任选一项即可（以 hasLocation 为准）。历史地名按它今天对应的实体归类。',
            criteria: {
                country: '国家、主权政治实体',
                city: '城市、城镇、聚落',
                region: '省、州、郡、地区、岛屿、沙漠',
                mountain: '山脉、山峰',
                sea: '海洋、海湾、湖泊、河流',
                landmark: '遗迹、建筑、地标',
            },
        },
    } satisfies Record<string, Experimental_EvaluationQuestion>

    return { state, questions }
}

/** Resolves a context-dependent place mention into a map-ready location. */
export async function resolveLocation({
    prompt,
    lang,
    kind,
}: {
    prompt: string
    lang: Lang
    kind: LocationKind | null
}): Promise<ResolvedLocation> {
    const language = LANG_NAME[lang] ?? LANG_NAME.en

    const { object } = await generateObject({
        ...locationAI,
        schema: LocationSchema,
        maxOutputTokens: 400,
        reasoning: 'minimal',
        prompt: `<task>
你在解析一段${language}文本中被选中的语块所指涉的地理位置，用于在地图上标注。必须结合上下文，而不只看字面。
</task>

<rules>
- 只输出一个最主要的实体。历史地名、旧称、别称都要转换成今天依然存在的城市、国家或地区。
- 预先判定的类别是 ${kind ?? '未定'}（country、city、region、mountain、sea、landmark 之一）；除非明显不符，否则沿用该类别。
- 若 kind 为 country：countryIso 填该国的 ISO 3166-1 alpha-2 代码（如 JP、FR、CN、NL），lat、lng、bbox 可为 null。
- 若为点状实体（city、landmark、单座山峰）：lat、lng 填现代坐标（WGS84 十进制度），bbox 为 null。
- 若为面状实体（sea、region、山脉、沙漠）：bbox 填 [西, 南, 东, 北] 四个经纬度边界值，lat、lng 可为 null。
- country 填该实体今天所属的国家名称（用${language}书写）；无法确定时为 null。
- label 用${language}书写，格式固定为"地名 / 国家 / 洲"，即用" / "依次连接地名、所属国家、所属大洲；仅当这个国家对${language}读者来说比较陌生、需要靠大洲来帮助定位时，才在末尾保留大洲，否则省略洲名。label 会被原样展示，不要加入其他内容或标点。
- explanation 用地道的${language}点出该地点与选中内容的关联，最多 6 个词，不加句号、不重复地名。只有当关联并非一目了然（需要背景知识才能理解为什么出现这个地名）时才填写；若地名本身就是选中内容或关联显而易见，则设为 null。
- confidence 为 0 到 1 的小数，表示你对定位准确度的把握；不确定唯一实体时把 confidence 设低。
</rules>

<text>
${prompt}
</text>`,
    })

    return object
}
