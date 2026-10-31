import { createHash } from 'node:crypto'
import type { Lang } from '@repo/schema/library'
import type { MobileSubject } from '@repo/schema/mobile'
import type { DefinitionServices, CompletedDefinition } from './definitions'
import { parseGeneratedDefinition } from './definitions'
import { MobileError } from './errors'

type GenerateDefinition = (signal: AbortSignal, delta?: (text: string) => void) => Promise<CompletedDefinition>

export async function prepareDefinition(
    services: DefinitionServices,
    input: {
        subject: MobileSubject
        language: Lang
        context: string
        cacheVersion: string
        signal: AbortSignal
        requestId?: string
    },
): Promise<GenerateDefinition> {
    const { accent, limit } = await services.preferences(input.subject)
    const key = createHash('sha256')
        .update(JSON.stringify([input.cacheVersion, input.language, accent, input.context]))
        .digest('hex')
    const cached = await services.cached(key)
    input.signal.throwIfAborted()
    if (!cached && !(await services.charge(input.subject, limit, input.requestId)))
        throw new MobileError('quota_exceeded')
    return async (signal, delta) => {
        signal.throwIfAborted()
        if (cached) return cached
        let generated = ''
        for await (const text of services.generate(input.context, input.language, accent, signal)) {
            signal.throwIfAborted()
            generated += text
            if (generated.length > 32000) throw new MobileError('service_unavailable')
            delta?.(text)
        }
        signal.throwIfAborted()
        const definition = parseGeneratedDefinition(generated)
        await services.cache(key, definition)
        return definition
    }
}

export function definitionResponse(input: {
    requestId: string
    signal: AbortSignal
    generate: GenerateDefinition
    complete: (definition: CompletedDefinition) => Promise<void>
    failed?: (error: unknown) => void
}): Response {
    const abort = new AbortController()
    const signal = AbortSignal.any([input.signal, abort.signal])
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            const emit = (frame: unknown) => {
                signal.throwIfAborted()
                controller.enqueue(encoder.encode(JSON.stringify(frame) + '\n'))
            }
            let pending = ''
            let sentDelta = false
            let timer: ReturnType<typeof setTimeout> | undefined
            const cancelFlush = () => {
                clearTimeout(timer)
                timer = undefined
            }
            const flush = () => {
                cancelFlush()
                if (!pending || signal.aborted) return
                emit({ kind: 'delta', requestId: input.requestId, text: pending })
                pending = ''
                sentDelta = true
            }
            const delta = (text: string) => {
                signal.throwIfAborted()
                // Bound each frame without splitting a Unicode code point. Send the
                // opening immediately, then combine small provider bursts for 24 ms.
                for (const part of text.match(/.{1,1024}/gsu) ?? []) {
                    pending += part
                    if (!sentDelta || pending.length >= 1024) flush()
                    else timer ??= setTimeout(flush, 24)
                }
            }
            signal.addEventListener('abort', cancelFlush, { once: true })
            try {
                emit({ kind: 'started', requestId: input.requestId })
                const definition = await input.generate(signal, delta)
                flush()
                signal.throwIfAborted()
                await input.complete(definition)
                emit({ kind: 'completed', requestId: input.requestId, definition })
            } catch (error) {
                flush()
                input.failed?.(error)
                if (!signal.aborted)
                    emit({
                        kind: 'failed',
                        requestId: input.requestId,
                        error: new MobileError(error instanceof MobileError ? error.code : 'service_unavailable').body
                            .error,
                    })
            } finally {
                cancelFlush()
                signal.removeEventListener('abort', cancelFlush)
                if (!abort.signal.aborted) controller.close()
            }
        },
        cancel() {
            abort.abort()
        },
    })
    return new Response(stream, {
        headers: {
            'Content-Type': 'application/x-ndjson',
            'Cache-Control': 'private, no-store',
            'X-Accel-Buffering': 'no',
        },
    })
}
