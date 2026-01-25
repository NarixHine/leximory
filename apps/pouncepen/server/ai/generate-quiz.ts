import 'server-only'
import { generateObject, streamObject } from 'ai'
import { z } from '@repo/schema'
import { SMART_AI } from './config'
import { QuizDataType } from '@repo/schema/paper'
import { AIGeneratableType } from '@repo/ui/paper/utils'

export async function streamQuiz({ prompt, type }: { prompt: string, type: AIGeneratableType }) {
    const { system, schema } = getConfig(type)
    const { partialObjectStream, object } = streamObject({
        prompt,
        system,
        schema,
        maxOutputTokens: 10000,
        ...SMART_AI
    })
    return { partialObjectStream, object }
}

export async function generateQuiz({ prompt, type }: { prompt: string, type: AIGeneratableType }) {
    const { system, schema } = getConfig(type)
    const { object } = await generateObject({
        prompt,
        system,
        schema,
        maxOutputTokens: 10000,
        ...SMART_AI
    })
    return object
}

const getConfig = (type: QuizDataType) => {
    switch (type) {
        case 'cloze':
            return {
                system: `把prompt出成英语高考完形填空，高考难度。\n输出JSON，形如{"text":"...<code>word</code>...",questions:[{original:"word",distractors:["distractor1","distractor2","distractor3"]}]}。在text里输出挖空的文本（挖空处加题号，将挖空词以<code></code>包裹，形如<code>word</code>），在questions数组中以对象形式输出每个被挖空词及其三个干扰项。不要含有任何序号。对下文出至多十五题（每题含三个干扰项）。例如若其中被挖空词有moral和effectively，应输出{"text":"...<code>moral</code>...<code>effectively</code>...","questions":[{"original":"moral","distractors":["scientific","potential","instant"]},{"original":"effectively","distractors":["hardly","likely","skillfully"]}]}。\n必须对所有十五题各给出三个distractors。禁止对同一单词反复挖空，尽可能广泛地考察词汇，选项中尽量使用常用词。挖空词汇必须与上下文强关联，且干扰项虽然属于同一词性词类但意义有显著不同，可以合理推断出答案选项。但是四个选项**两两间必须均有差异**，换言之，三个干扰项不得全是反义词。例如，对于effective，你可以给出conscious、peaceful、refreshed等意思有关联而有显著差异的干扰项，但禁止三个选项全部为ineffective、futile、useless。\n挖空分布必须均匀地贯穿全文，且不应过密。不对生僻词汇挖空，禁止使用难词出题；至少出一题逻辑副词/连词题（however, therefore, instead, ...）。必须保留其余原有的HTML格式、换行（用换行作为分段）、标签。如果原文无HTML格式，则将转换为含适当的段落等语法的HTML。禁止在挖空前加序号。`,
                schema: z.object({
                    text: z.string().describe('挖空的文本'),
                    questions: z.array(z.object({
                        original: z.string().describe('被挖空的词'),
                        distractors: z.array(z.string()).length(3).describe('该题的三个干扰项')
                    }))
                })
            }
        case 'fishing':
            return {
                system: `把prompt出成英语高考小猫钓鱼题（十一选十），高考难度。\n在text里输出挖空的文本（**只需**将挖空词以<code></code>包裹，形如<code>word</code>），在distrators输出干扰项数组。必须对下文出十空，并只对其中一空出一个干扰项（与原文词汇易混淆但有**巨大**的词义区别），例如{"text":"...<code>word</code>...","distractors":["lexicon"]}}。不要输出任何序号。\n一共出十题，即你必须**对十个单词进行挖空**，并另外添加**一个干扰项**（要求与原文对应词词类相同、易混淆但词义差异显著）。禁止对同一单词反复挖空，尽可能广泛地考察词性不同的词汇，选项中尽量使用常用词。挖空词汇必须与上下文强关联，可以合理推断出答案。挖空分布必须均匀分布，所以要事先做好规划，确保贯穿全文每一段落。必须保留其余原有的HTML格式、换行（用换行作为分段）、标签。如果原文无HTML格式，则将转换为含适当的段落等语法的HTML。禁止在挖空前加序号。`,
                schema: z.object({
                    text: z.string().refine(
                        (text) => (text.match(/<code>/g) || []).length >= 5,
                        { message: '文本中必须至少有五个挖空词' }
                    ).describe('挖空的文本'),
                    distractors: z.array(z.string()).length(1).describe('一个干扰项')
                })
            }
        case 'reading':
            return {
                system: `把prompt出成英语高考阅读理解题，高考难度。\n在questions输出题目数组。每个题目以q为问题，a为四个选项，correct为正确选项下标。\n一共出五题，考察内容均匀。供参考的出题方向：事实信息题、内容推断题（What can you infer）、标题推测题（What is the best title，仅当标题未给定时出）、句子作用题、生僻单词/生僻词组语义推测题、态度判断题（What is the author's attitude）……必须保留其余原有的HTML格式、换行（用换行作为分段）、标签。如果原文无HTML格式，则将转换为含适当的段落等语法的HTML。`,
                schema: z.object({
                    questions: z.array(z.object({
                        q: z.string().describe('题目'),
                        a: z.array(z.string()).describe('选项'),
                        correct: z.number().describe('正确答案的下标')
                    }))
                })
            }
        default:
            throw new Error()
    }
}
