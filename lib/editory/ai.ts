'use server'

import { generateObject } from 'ai'
import { Schema, z } from 'zod'
import { googleModels } from '../config'
import { QuizDataType } from './types'

export default async function generate({ prompt, type }: { prompt: string, type: QuizDataType }) {
    const { system, schema } = getConfig(type)
    const { object } = await generateObject({
        model: googleModels['pro-2.5'],
        prompt,
        system,
        schema,
        maxTokens: 15000,
    })
    console.log(object)
    return {
        ...object,
        text: object.text?.replaceAll('\n', '<br>')
    }
}

const getConfig = (type: QuizDataType): { system: string, schema: Schema } => {
    switch (type) {
        case 'cloze':
            return {
                system: `把prompt出成英语高考完形填空，高考难度。\n输出JSON，形如{"text":"...<code>word</code>...",questions:[{original:"word",distractors:["distractor1","distractor2","distractor3"]}]}。在text里输出挖空的文本（挖空处加题号，将挖空词以<code></code>包裹，形如<code>word</code>），在questions数组中以对象形式输出每个被挖空词及其三个干扰项。不要含有任何序号。对下文出十五题（每题含三个干扰项）。例如若其中被挖空词有moral和effectively，应输出{"text":"...<code>moral</code>...<code>effectively</code>...","questions":[{"original":"moral","distractors":["scientific","potential","instant"]},{"original":"effectively","distractors":["hardly","likely","skillfully"]}]}。\n必须对所有十五题各给出三个distractors。禁止对同一单词反复挖空，尽可能广泛地考察词汇，选项中尽量使用常用词。挖空词汇必须与上下文强关联，可以合理推断出答案。挖空分布必须均匀，贯穿全文。必须保留其余原有的HTML格式和标签。`,
                schema: z.object({
                    text: z.string().describe('挖空的文本'),
                    questions: z.array(z.object({
                        original: z.string().describe('被挖空的词'),
                        distractors: z.array(z.string()).describe('该题的三个干扰项')
                    }))
                })
            }
        case 'fishing':
            return {
                system: `把prompt出成英语高考小猫钓鱼题（十一选十），高考难度。\n在text里输出挖空的文本（挖空处加题号，将挖空词以<code></code>包裹，形如<code>word</code>），在distrators输出干扰项数组。必须对下文出至少十空（至多十五空），必须对其中一空出一个干扰项（易混淆但有区别），例如{"text":"...<code>word</code>...","distractors":["lexicon"]}}。不要输出任何序号。\n一共出十题，即你必须对十个单词进行挖空，并另外添加一个干扰项。禁止对同一单词反复挖空，尽可能广泛地考察词性不同的词汇，选项中尽量使用常用词。挖空词汇必须与上下文强关联，可以合理推断出答案。挖空分布必须均匀，贯穿全文。必须保留其余原有的HTML格式和标签。`,
                schema: z.object({
                    text: z.string().describe('挖空的文本'),
                    distractors: z.array(z.string()).describe('一个干扰项')
                })
            }
        case 'reading':
            return {
                system: `把prompt出成英语高考阅读理解题，高考难度。\n在questions输出题目数组。每个题目以q为问题，a为四个选项，correct为正确选项下标。\n一共出五题，考察内容均匀：你可以出事实信息题、内容推断题（What can you infer）、标题推测题（What is the best title）、态度判断题（What is the author's attitude）等。必须保留其余原有的HTML格式和标签。`,
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
