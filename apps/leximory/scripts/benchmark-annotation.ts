import { writeFile } from 'node:fs/promises'
import { generateText } from 'ai'
import { instruction } from '@/lib/prompt'
import { miniAI } from '@/server/ai/config'

const passages = [
    {
        title: 'The North Carolina Senate race',
        text: `By the time Election Day rolled around, Roy Cooper’s victory in the Senate race in North Carolina, which flipped a seat in the chamber from Republican to Democrat, was almost a foregone conclusion, given how early he took a lead in polls, [how consistently he held on to it](https://www.nytimes.com/2026/09/07/opinion/roy-cooper-senate-carolina.html) and how increasingly hostile to Republicans the midterm climate seemed to be.

But make no mistake: This is [a purple state](https://www.nytimes.com/2025/10/27/opinion/north-carolina-gerrymander-republicans.html), a dab redder than it is blue, and it hadn’t chosen a Democrat in a Senate or presidential contest since 2008, when Barack Obama came out on top here. It was anyone’s to win before Cooper kicked off his bid. And his triumph speaks to a whole lot more than good timing.`,
    },
    {
        title: 'AI consciousness',
        text: `Even if current A.I. systems are not conscious, future systems might be. Suppose the skeptics are right that consciousness requires features that current A.I. systems lack, like the electrochemical activity of biological tissue. Many companies are already exploring new design possibilities, including [robots](https://deepmind.google/blog/gemini-robotics-brings-ai-into-the-physical-world/) with sophisticated sensory and motor capacities, [computer chips](https://www.intel.com/content/www/us/en/newsroom/news/intel-builds-worlds-largest-neuromorphic-system.html) designed to mimic biological neurons and even systems incorporating living [neural tissue](https://www.corticallabs.com/cl1.html).

To be clear, I am not arguing that we should try to build conscious A.I. On the contrary, I think we should be cautious about creating entities with the capacity for conscious experiences — particularly the experience of pain. If A.I. systems can suffer, we have a moral responsibility to recognize their interests and consider how our actions affect them. And because A.I. systems can proliferate extremely quickly, A.I. consciousness would create the possibility of suffering on an enormous scale.`,
    },
]

const variants = [
    { label: 'Gemini · medium', model: 'google/gemini-3.8-flash', reasoning: null },
    { label: 'DeepSeek · none', model: 'deepseek/deepseek-v4.1-flash-1017', reasoning: 'none' },
    { label: 'DeepSeek · low', model: 'deepseek/deepseek-v4.1-flash-1017', reasoning: 'low' },
    { label: 'DeepSeek · medium', model: 'deepseek/deepseek-v4.1-flash-1017', reasoning: 'medium' },
    { label: 'DeepSeek · high', model: 'deepseek/deepseek-v4.1-flash-1017', reasoning: 'high' },
] as const

async function main() {
    const runs = await Promise.all(
        passages.flatMap((passage, passageIndex) =>
            variants.map(async (variant) => {
                const prompt = {
                    instructions: `
        生成文本注解（形如 [[vocabulary]] 双重中括号内的词以及形如<must>vocabulary</must>的词必须注解，除此以外***尽可能多***地挑选。

        ${instruction.en}

        你将会看到一段网页文本，你首先要删去首尾的标题、作者、日期、导航和插入正文的广告等无关部分，段与段间空两行，并提取出其中的正文。
    `,
                    prompt: `
    你要为外语学习者注解一切高阶或罕见词汇，必须添加语源。注解必须均匀地遍布下文。
    
    用户偏好：美式英语。请使用美式英语拼写、发音和语汇。
    
    ${passage.text}`,
                    maxOutputTokens: 12000,
                }
                const started = performance.now()
                try {
                    const result = await generateText({
                        ...prompt,
                        model: variant.model,
                        reasoning: variant.reasoning ?? undefined,
                        providerOptions: variant.reasoning === null ? miniAI.providerOptions : {},
                        abortSignal: AbortSignal.timeout(240_000),
                    })
                    const durationMs = Math.round(performance.now() - started)
                    console.log(`${passageIndex + 1} ${variant.label}: ${durationMs}ms (${result.finishReason})`)
                    return {
                        passageIndex,
                        ...variant,
                        durationMs,
                        text: result.text,
                        finishReason: result.finishReason,
                        usage: result.usage,
                    }
                } catch (error) {
                    const durationMs = Math.round(performance.now() - started)
                    const message = error instanceof Error ? error.message : 'Request failed'
                    console.error(`${passageIndex + 1} ${variant.label}: ${message}`)
                    return { passageIndex, ...variant, durationMs, text: '', finishReason: 'error', error: message }
                }
            }),
        ),
    )

    const file = '/tmp/leximory-annotation-benchmark.json'
    await writeFile(file, JSON.stringify({ generatedAt: new Date().toISOString(), passages, runs }, null, 2))
    console.log(`Saved ${file}`)
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
