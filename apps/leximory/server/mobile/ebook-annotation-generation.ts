import 'server-only'
import { randomUUID } from 'node:crypto'
import { streamText, type LanguageModel, type LanguageModelUsage } from 'ai'
import type { Lang } from '@repo/schema/library'
import { commentSyntaxRegex, parseWord } from '@repo/utils/comment'
import { annotationPrompt } from '../ai/annotation-prompt'
import { parseGeneratedDefinition } from './definitions'
import { MobileError } from './errors'
import type { GeneratedEbookAnnotation } from './ebook-annotations'
import { mobileNanoAI } from './ai-config'

export type EbookAnnotationDebugEvent = { requestId: string } & (
    | { kind: 'prompt'; model: string; reasoning: 'low'; instructions: string; prompt: string }
    | {
          kind: 'generation'
          status: 'complete' | 'failed' | 'cancelled'
          output: string
          elapsedMs: number
          firstTextMs: number | null
          firstAnnotationMs: number | null
          usage: LanguageModelUsage | null
      }
)

export async function* streamEbookAnnotations(input: {
    model?: LanguageModel
    text: string
    language: Lang
    accent: string
    signal: AbortSignal
    requestId?: string
    debug?: (event: EbookAnnotationDebugEvent) => void
}): AsyncGenerator<GeneratedEbookAnnotation> {
    const requestId = input.requestId ?? randomUUID(),
        started = performance.now()
    const debug =
        input.debug ??
        ((event: EbookAnnotationDebugEvent) => console.info(JSON.stringify({ event: 'ebook.annotation', ...event })))
    const log = (event: EbookAnnotationDebugEvent) => {
        try {
            debug(event)
        } catch {}
    }
    const config = annotationPrompt({
        lang: input.language,
        input: input.text,
        autoTrim: false,
        compact: true,
        accentPrompt:
            input.language === 'en' ? `用户偏好：${input.accent}。请使用${input.accent}拼写、发音和语汇。` : '',
    })
    const abort = new AbortController()
    log({
        kind: 'prompt',
        requestId,
        model: mobileNanoAI.model,
        reasoning: 'low',
        instructions: config.instructions,
        prompt: config.prompt,
    })
    let pending = '',
        sourceOffset = 0,
        received = 0
    let output = '',
        firstTextMs: number | null = null,
        firstAnnotationMs: number | null = null
    let status: 'complete' | 'failed' | 'cancelled' = 'cancelled'
    let usage: LanguageModelUsage | null = null
    const syntax = new RegExp(commentSyntaxRegex)
    try {
        const result = streamText({
            ...config,
            ...mobileNanoAI,
            ...(input.model ? { model: input.model } : {}),
            abortSignal: AbortSignal.any([input.signal, abort.signal]),
        })
        for await (const delta of result.textStream) {
            input.signal.throwIfAborted()
            received += delta.length
            if (received > 512000) throw new MobileError('service_unavailable')
            pending += delta
            output += delta
            firstTextMs ??= performance.now() - started
            while (true) {
                const match = pending.matchAll(syntax).next().value
                if (!match) break
                const quote = parseWord(match[0])[0]
                if (!quote) throw new MobileError('service_unavailable')
                const prefix = pending.slice(0, match.index).trimStart()
                const fragment = input.text.indexOf(prefix + quote, sourceOffset)
                let start = fragment < 0 ? input.text.indexOf(quote, sourceOffset) : fragment + prefix.length
                // Rewritten context cannot safely identify a repeated word.
                if (fragment < 0 && start >= 0 && input.text.indexOf(quote, start + 1) >= 0) start = -1
                const definition = parseGeneratedDefinition(match[0])
                if (start >= 0) {
                    let occurrence = 0,
                        offset = -1
                    do {
                        offset = input.text.indexOf(quote, offset + 1)
                        occurrence++
                    } while (offset < start)
                    sourceOffset = start + quote.length
                    firstAnnotationMs ??= performance.now() - started
                    yield { quote, occurrence, definition }
                }
                pending = pending.slice(match.index + match[0].length)
            }
        }
        if (pending.includes('{{') || (await result.finishReason) !== 'stop')
            throw new MobileError('service_unavailable')
        usage = await result.totalUsage
        status = 'complete'
    } catch (error) {
        status = input.signal.aborted ? 'cancelled' : 'failed'
        throw error
    } finally {
        abort.abort()
        log({
            kind: 'generation',
            requestId,
            status,
            output,
            elapsedMs: performance.now() - started,
            firstTextMs,
            firstAnnotationMs,
            usage,
        })
    }
}
