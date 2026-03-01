import { ClozeDataSchema, CustomDataSchema, FishingDataSchema, GrammarDataSchema, ReadingDataSchema, SentenceChoiceDataSchema, SummaryDataSchema, TranslationDataSchema, WritingDataSchema } from '@repo/schema/paper'
import { omit } from 'es-toolkit'
import { z } from '@repo/schema'
import { questionStrategiesList } from '@repo/ui/paper/strategies'

const SECTIONS = {
        grammar: {
                name: '语法填空（Grammar & Vocabulary: Section A）',
                description: `
填空题：对虚词（或实词）挖空并让考生填出虚词（或实词的适当形式）。实词题空格后有小括号，小括号内为提示词。
    - 对于不给提示词的空格，考生需要填入适当的虚词（如介词、连词、冠词、代词等），且每一小题含有1～3条横线，横线中间以空格分隔，每横线都只填一词。根据横线数量，每道题可以填入1～3个词。此处不允许填入实词。
    - 而对于在小括号内给出提示词的空格，考生则需要填入所给提示词的适当形式，如时态语态等，但不得改变词性。提示词只可能是动词、形容词或副词。
        `.trim(),
                format: `
该大题type为grammar。需要按照试题对词汇或词组进行相同挖空。每道题可能有多个正确答案，正确答案用/连接（必须使用此语法表示多个答案，且斜杠左右无空格）。
对于在PDF中紧跟有小括号包裹的提示词的空格，必须在hints中以答案（被挖空的原文）为键、以小括号内的提示词为值输出object。空格后无括号的空格则跳过此步。
强调：括号内的提示词在输出文本中**禁止出现**，而是在hints中输出。
        `.trim(),
                schema: GrammarDataSchema.omit({ id: true })
        }, fishing: {
                name: '十一选十/选词（Grammar & Vocabulary: Section B）',
                description: `
选择题：以语篇的形式呈现，设置10道空白处，要求考生从11个单词构成的词库里选出最合适的词分别填入各空白处，使短文意思和结构完整。
每个单词只能选一次，有1个单词为干扰项。
        `.trim(),
                format: `
该大题type为fishing。需要按照试题对词汇进行相同挖空。
没有在答案中出现的选项所代表的词汇为干扰项。找出干扰项，放入distractors数组。
        `.trim(),
                schema: FishingDataSchema.omit({ id: true })
        }, cloze: {
                name: '完形填空（Reading Comprehension: Section A）',
                description: `
选择题：在短文中删去原词，留出15个空格。
每题有四个备选项（其中三个为干扰项），一般都属于同一词类。将其中一个选项填入空白处，使句子意思和结构完整、与上下文文意相符。
        `.trim(),
                format: `
该大题type为cloze。需要按照试题对词汇或词组进行相同挖空。
对于每个被挖空的词汇，有三个干扰项。在questions数组中，每个空格对应一个对象，original键的值为被挖空的词汇（即答案），distractors键的值为题目中的干扰项数组。
        `.trim(),
                schema: ClozeDataSchema.omit({ id: true })
        },
        reading: {
                name: '阅读理解（Reading Comprehension: Section B）',
                description: `
选择题：包含三篇阅读文章，每篇文章下的题目都是四选一式的选择题。
考生需要根据文章内容选择唯一正确答案。
        `.trim(),
                format: `
该大题type为reading。无需挖空。
questions数组中，每个问题对象包含q、a、correct，分别对应题干、选项数组和正确答案下标（0~3）。
导入时需要包含文章编号（A/B/C）。
        `.trim(),
                schema: ReadingDataSchema.omit({ id: true })
        },
        sentences: {
                name: '六选四（Reading Comprehension: Section C）',
                description: `
选择题：六选四即从六个句子中选取四个填入文中适当位置。
试卷给出一篇缺少4个句子的语篇，对应有6个句子选项，其中2个为干扰项。考察考生对语篇结构和逻辑的理解能力。
        `.trim(),
                format: `
该大题type为sentences。需要按照试题对句子进行相同挖空。
该大题总共有两个干扰项。答案中未出现选项所代表的句子为干扰项，找出后将句子放入distractors数组。
        `.trim(),
                schema: SentenceChoiceDataSchema.omit({ id: true })
        },
        summary: {
                name: '摘要（Summary Writing）',
                description: `
摘要题：要求考生阅读一篇短文，然后用自己的话概括短文的主要内容（不超过61词）。
评分标准：内容5分（必须涵盖的核心要点和补充细节），语言5分（简洁性和准确性）。
        `.trim(),
                format: `
该大题type为summary。text字段包含原文。essentialItems数组包含核心要点（通常3个，涉及核心结构），extraItems数组包含补充细节（通常2个）。referenceSummary字段包含参考摘要。
若答案中只有参考摘要而无要点分类，请根据对原文核心结构/补充细节的客观分析填充essentialItems和extraItems。
        `.trim(),
                schema: SummaryDataSchema.omit({ id: true })
        },
        translation: {
                name: '翻译（Translation）',
                description: `
翻译题：要求考生将给定的中文句子翻译成英语，必须使用括号中给出的关键词或句型。典型的翻译共4小题，分值分别为3、4、4、5分。
        `.trim(),
                format: `
该大题type为translation。items数组中，每个对象包含chinese（中文原句）、keyword（括号中的关键词）、references（参考译文数组）和score（该小题分值）。
        `.trim(),
                schema: TranslationDataSchema.omit({ id: true })
        },
        writing: {
                name: '写作（Guided Writing）',
                description: `
写作题：要求考生根据中文指示写一篇英语作文，通常指定字数范围。
        `.trim(),
                format: `
该大题type为writing。guidance字段包含作文指示（中文提示，使用HTML格式）。
        `.trim(),
                schema: WritingDataSchema.omit({ id: true })
        }
} as const

type SectionType = keyof typeof SECTIONS
const SECTION_TYPES = Object.keys(SECTIONS) as SectionType[]
const SECTION_QUIZ_TYPES = ['grammar', 'fishing', 'cloze', 'reading', 'sentences', 'custom', 'summary', 'translation', 'writing'] as const
const SECTION_NAMES = Object.values(SECTIONS).map(section => section.name)
export const SectionTypeSchema = z.enum(SECTION_TYPES)

const details = (Object.keys(SECTIONS) as Array<keyof typeof SECTIONS>).map((section) => {
        return `<${section}>
        ${SECTIONS[section].description}
        </${section}>`
})
const examples = questionStrategiesList.filter((strategy) => (SECTION_QUIZ_TYPES as readonly string[]).includes(strategy.getDefaultValue().type)).map((strategy) => {
        const value = omit(strategy.getDefaultValue(), ['id'])
        return `<${value.type}>
        ${JSON.stringify(value, null, 2)}
        </${value.type}>`
})
const formats = (Object.keys(SECTIONS) as Array<keyof typeof SECTIONS>).map((section) => {
        return `<${section}>
        ${SECTIONS[section].format}
        </${section}>`
})

const GeneratableDataSchema = z.union(Object.values(SECTIONS).map(s => s.schema))

export { SECTIONS, SECTION_TYPES, SECTION_NAMES, details, examples, formats, GeneratableDataSchema }
export { type SectionType }
