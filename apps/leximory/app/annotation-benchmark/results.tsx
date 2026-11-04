'use client'

import { Card, CardBody } from '@heroui/card'
import Markdown from '@/components/markdown'

type Run = {
    passageIndex: number
    label: string
    model: string
    durationMs: number
    text: string
    finishReason: string
    error?: string
    usage?: { inputTokens?: number; outputTokens?: number }
}
type Data = { generatedAt: string; passages: { title: string; text: string }[]; runs: Run[] }

export default function Benchmark({ data }: { data: Data | null }) {
    return (
        <main className="mx-auto w-full max-w-[1900px] px-5 pb-28 pt-12 sm:px-10">
            <header className="mx-auto max-w-5xl border-b border-default-200 pb-8">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-default-500">
                    Leximory · annotation benchmark
                </p>
                <h1 className="font-fancy text-4xl sm:text-5xl">The reading test</h1>
                <p className="mt-4 max-w-2xl text-default-600">
                    Two passages, five model settings. Read the annotations and compare their context, accuracy, and
                    coverage.
                </p>
                <p className="mt-3 text-sm text-default-500">
                    The production English article prompt is used for every run, with the same American English
                    preference. Each result is one sample; requests ran concurrently. Output tokens include reasoning
                    tokens when reported by the provider.
                </p>
            </header>
            {!data ? (
                <p className="mx-auto mt-12 max-w-5xl text-default-500">
                    The benchmark is still running. Refresh this page when it finishes.
                </p>
            ) : (
                data.passages.map((passage, index) => {
                    const runs = data.runs.filter((run) => run.passageIndex === index)
                    const slowest = Math.max(...runs.map((run) => run.durationMs), 1)
                    return (
                        <section key={passage.title} className="mt-16">
                            <div className="mx-auto max-w-5xl">
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-default-500">
                                    Passage {index + 1}
                                </p>
                                <h2 className="mt-2 font-fancy text-3xl">{passage.title}</h2>
                                <details className="mt-4 text-sm text-default-600">
                                    <summary className="cursor-pointer font-medium text-foreground">
                                        Original passage
                                    </summary>
                                    <div className="mt-4 whitespace-pre-wrap leading-7">{passage.text}</div>
                                </details>
                                <div className="mt-6 space-y-2" aria-label="Response times">
                                    {runs.map((run) => (
                                        <div
                                            key={run.label}
                                            className="grid grid-cols-[9rem_1fr_4rem] items-center gap-3 text-xs sm:grid-cols-[11rem_1fr_4rem]"
                                        >
                                            <span>{run.label}</span>
                                            <div className="h-2 rounded-full bg-default-100">
                                                <div
                                                    className={`h-2 rounded-full ${run.error ? 'bg-danger' : run.label.startsWith('Gemini') ? 'bg-primary' : 'bg-success'}`}
                                                    style={{ width: `${(run.durationMs / slowest) * 100}%` }}
                                                />
                                            </div>
                                            <span className="text-right tabular-nums text-default-500">
                                                {(run.durationMs / 1000).toFixed(1)}s
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="mt-8 grid auto-cols-[minmax(320px,1fr)] grid-flow-col gap-4 overflow-x-auto pb-4">
                                {runs.map((run) => (
                                    <Card
                                        key={run.label}
                                        shadow="none"
                                        className="min-w-[320px] border border-default-200 bg-content1"
                                    >
                                        <CardBody className="gap-4 p-5">
                                            <div className="border-b border-default-100 pb-4">
                                                <h3 className="text-lg font-semibold">{run.label}</h3>
                                                <p className="mt-1 text-xs text-default-500">
                                                    {(run.durationMs / 1000).toFixed(1)}s ·{' '}
                                                    {run.usage?.outputTokens ?? '—'} output tokens · {run.finishReason}
                                                </p>
                                            </div>
                                            {run.finishReason === 'length' && (
                                                <p className="text-sm text-warning">Reached the 12,000-token limit. The response may be incomplete.</p>
                                            )}
                                            {run.error ? (
                                                <p className="text-sm text-danger">{run.error}</p>
                                            ) : (
                                                <Markdown md={run.text} disableSave className="max-w-none text-sm" />
                                            )}
                                            {!run.error && (
                                                <details className="mt-auto text-xs text-default-500">
                                                    <summary className="cursor-pointer">Raw output</summary>
                                                    <pre className="mt-3 whitespace-pre-wrap break-words">
                                                        {run.text}
                                                    </pre>
                                                </details>
                                            )}
                                        </CardBody>
                                    </Card>
                                ))}
                            </div>
                        </section>
                    )
                })
            )}
        </main>
    )
}
