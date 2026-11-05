import { readFile } from 'node:fs/promises'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { z } from 'zod'
import Benchmark from './results'

const dataSchema = z.object({
    generatedAt: z.string(),
    passages: z.array(z.object({ title: z.string(), text: z.string() })),
    runs: z.array(
        z.object({
            passageIndex: z.number(),
            label: z.string(),
            model: z.string(),
            durationMs: z.number(),
            text: z.string(),
            finishReason: z.string(),
            error: z.string().optional(),
            usage: z.object({ inputTokens: z.number().optional(), outputTokens: z.number().optional() }).optional(),
        }),
    ),
})

export default async function AnnotationBenchmarkPage() {
    if (process.env.NODE_ENV !== 'development') notFound()
    await connection()

    let data: z.infer<typeof dataSchema> | null = null
    try {
        data = dataSchema.parse(JSON.parse(await readFile('/tmp/leximory-annotation-benchmark.json', 'utf8')))
    } catch {
        // The benchmark runner may still be collecting results.
    }
    return <Benchmark data={data} />
}
