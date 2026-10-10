import { randomUUID, createHash } from 'node:crypto'
import { z } from 'zod'
import { definitionSchema, vocabularyInputSchema, ebookSelectionSchema, resourceID } from '@repo/api'
import { occurrenceSchema, type MobileSubject, type Occurrence } from '@repo/schema/mobile'
import type { Lang } from '@repo/schema/library'
import { createCatalog, type CatalogStore } from './catalog'
import { renderDocument, resolveOccurrence, OccurrenceError } from './render-document'
import { MobileError, mobileErrorResponse } from './errors'
import { requireMobileSubject, type BearerVerifier } from './auth'

export type CompletedDefinition = z.infer<typeof definitionSchema>
export const receiptSchema = z.object({ subject: z.string(), occurrence: occurrenceSchema, definition: definitionSchema }).strict()
export type Receipt = z.infer<typeof receiptSchema>
export interface DefinitionServices {
    preferences(subject: MobileSubject): Promise<{ accent: string; limit: number }>
    cached(key: string): Promise<CompletedDefinition | null>
    cache(key: string, definition: CompletedDefinition): Promise<void>
    charge(subject: MobileSubject, limit: number): Promise<boolean>
    generate(context: string, language: Lang, accent: string, signal: AbortSignal): AsyncIterable<string>
    complete(id: string, receipt: Receipt): Promise<void>
    receipt(id: string): Promise<Receipt | null>
    save(subject: MobileSubject, sourceLibrary: string, language: Lang, definition: CompletedDefinition, requestId?: string): Promise<{ id: string; libraryId: string }>
}
export function parseGeneratedDefinition(value: string): CompletedDefinition {
    const match = /^\s*\{\{([^{}]+)\}\}\s*$/.exec(value)
    const portions = match?.[1]?.split('||').map(value => value.trim())
    if (!portions || portions.length < 3 || portions.length > 5 || portions.some(value => !value)) throw new MobileError('service_unavailable')
    return definitionSchema.parse({ lemma: portions[1], definition: portions[2], etymology: portions[3] ?? null, cognates: portions[4] ?? null })
}
export async function jsonBody(request: Request, maxBytes = 8192): Promise<unknown> {
    // Bound request bytes, including chunked requests without Content-Length.
    const reader = request.body?.getReader()
    if (!reader) throw new MobileError('invalid_input')
    const chunks: Uint8Array[] = []; let count = 0
    try {
        while (true) {
            const chunk = await reader.read()
            if (chunk.done) break
            count += chunk.value.byteLength
            if (count > maxBytes) { await reader.cancel(); throw new MobileError('invalid_input') }
            chunks.push(chunk.value)
        }
        return JSON.parse(Buffer.concat(chunks).toString('utf8'))
    } catch { throw new MobileError('invalid_input') }
    finally { reader.releaseLock() }
}
function occurrence(document: ReturnType<typeof renderDocument>, input: unknown, textId: string) {
    try {
        const resolved = resolveOccurrence(document, input)
        if (resolved.occurrence.textId !== textId || resolved.selectedText.length > 1024 || resolved.context.length > 30000) throw new MobileError('invalid_input')
        return resolved
    } catch (error) { if (error instanceof OccurrenceError) throw new MobileError(error.code); throw error }
}
export function createDefinitionHandler(dependencies: { verify: BearerVerifier; store: CatalogStore; services: DefinitionServices; requestID?: () => string }) {
    const { services } = dependencies
    const catalog = createCatalog(dependencies.store)
    return async (request: Request): Promise<Response> => {
        try {
            const subject = await requireMobileSubject(request, dependencies.verify)
            const match = /^\/api\/mobile\/v1\/texts\/([A-Za-z0-9_-]{1,128})\/(definitions|vocabulary|ebook-definitions|ebook-vocabulary)$/.exec(new URL(request.url).pathname)
            const textId = match?.[1]
            if (!textId || request.method !== 'POST') throw new MobileError('inaccessible')
            const body = await jsonBody(request)
            const { text, library } = await catalog.authorizedText(subject, textId, request.signal)
            const ebookRequest = match[2]?.startsWith('ebook-') === true
            if (text.bookmark_url || text.has_ebook !== ebookRequest) throw new MobileError('unsupported_format')
            if (match[2] === 'ebook-vocabulary') {
                const input = z.object({ completionId: resourceID, requestId: resourceID.optional() }).strict().safeParse(body)
                if (!input.success) throw new MobileError('invalid_input')
                const receipt = await services.receipt(input.data.completionId)
                if (!receipt || receipt.subject !== subject.userId || receipt.occurrence.textId !== textId || receipt.occurrence.blockId !== 'ebook-selection') throw new MobileError('invalid_input')
                return Response.json(await services.save(subject, library.id, library.lang, receipt.definition, input.data.requestId), { headers: { 'Cache-Control': 'private, no-store' } })
            }
            const document = renderDocument(text.content)
            if (match[2] === 'vocabulary') {
                const parsed = vocabularyInputSchema.safeParse(body)
                if (!parsed.success) throw new MobileError('invalid_input')
                const resolved = occurrence(document, parsed.data.occurrence, textId)
                let definition: CompletedDefinition
                if (parsed.data.completionId) {
                    const receipt = await services.receipt(parsed.data.completionId)
                    if (!receipt || receipt.subject !== subject.userId || JSON.stringify(receipt.occurrence) !== JSON.stringify(resolved.occurrence)) throw new MobileError('invalid_input')
                    definition = receipt.definition
                } else {
                    const span = document.blocks.find(block => block.id === resolved.occurrence.blockId)?.spans.find(span => span.kind === 'definition' && span.range.location === resolved.occurrence.range.location && span.range.length === resolved.occurrence.range.length)
                    if (!span || span.kind !== 'definition') throw new MobileError('invalid_input')
                    definition = definitionSchema.parse({ lemma: span.lemma, definition: span.definition, etymology: span.etymology, cognates: span.cognates })
                }
                const saved = await services.save(subject, library.id, library.lang, definition, parsed.data.requestId)
                return Response.json(saved, { headers: { 'Cache-Control': 'private, no-store' } })
            }
            const resolved = (() => {
                if (ebookRequest) {
                    const parsed = ebookSelectionSchema.safeParse(body)
                    if (!parsed.success) throw new MobileError('invalid_input')
                    const { quote, context, offset } = parsed.data
                    if (context.slice(offset, offset + quote.length) !== quote) throw new MobileError('invalid_input')
                    // EPUB/PDF selections originate in the rendered asset, as on web.
                    // They are untrusted plain context, never stored article ranges.
                    const revision = createHash('sha256').update(context).digest('hex')
                    return { occurrence: { textId, revision, blockId: 'ebook-selection', range: { location: offset, length: quote.length } },
                        context: context.slice(0, offset) + '[[' + quote + ']]' + context.slice(offset + quote.length) }
                }
                const parsed = occurrenceSchema.omit({ textId: true }).safeParse(body)
                if (!parsed.success) throw new MobileError('invalid_input')
                return occurrence(document, { textId, ...parsed.data }, textId)
            })()
            const preferences = await services.preferences(subject)
            // Version tag invalidates entries produced by an older guide or model.
            const key = createHash('sha256').update(JSON.stringify(['mobile-definition-v3', library.lang, preferences.accent, resolved.context])).digest('hex')
            const cached = await services.cached(key)
            if (!cached && !await services.charge(subject, preferences.limit)) throw new MobileError('quota_exceeded')
            request.signal.throwIfAborted()
            const requestId = dependencies.requestID?.() ?? randomUUID()
            const abort = new AbortController()
            const signal = AbortSignal.any([request.signal, abort.signal, AbortSignal.timeout(60000)])
            const encoder = new TextEncoder()
            const stream = new ReadableStream<Uint8Array>({
                async start(controller) {
                    const emit = (frame: unknown) => { signal.throwIfAborted(); controller.enqueue(encoder.encode(JSON.stringify(frame) + '\n')) }
                    try {
                        emit({ kind: 'started', requestId })
                        let completed = cached
                        if (!completed) {
                            let generated = ''
                            for await (const delta of services.generate(resolved.context, library.lang, preferences.accent, signal)) {
                                generated += delta
                                if (generated.length > 32000) throw new MobileError('service_unavailable')
                                emit({ kind: 'delta', requestId, text: delta })
                            }
                            signal.throwIfAborted()
                            completed = parseGeneratedDefinition(generated)
                            await services.cache(key, completed)
                        }
                        await services.complete(requestId, { subject: subject.userId, occurrence: resolved.occurrence, definition: completed })
                        emit({ kind: 'completed', requestId, definition: completed })
                    } catch (error) {
                        if (!signal.aborted) emit({ kind: 'failed', requestId, error: new MobileError(error instanceof MobileError ? error.code : 'service_unavailable').body.error })
                    } finally { if (!abort.signal.aborted) controller.close() }
                },
                cancel() { abort.abort() },
            })
            return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'private, no-store', 'X-Accel-Buffering': 'no' } })
        } catch (error) { return mobileErrorResponse(error) }
    }
}
