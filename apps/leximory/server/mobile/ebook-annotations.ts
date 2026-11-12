import 'server-only'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { ebookAnnotationInputSchema, ebookAnnotationSchema, resourceID } from '@repo/api'
import { EBOOK_ANNOTATION_COST_PER_THOUSAND } from '@repo/env/content'
import type { Lang } from '@repo/schema/library'
import { createCatalog, type CatalogStore } from './catalog'
import type { EbookStore } from './ebooks'
import type { DefinitionServices } from './definitions'
import { MobileError } from './errors'
import { checkedResponse, jsonBody, type MobileContext, type MobileOperation } from './http'

export type EbookAnnotation = z.infer<typeof ebookAnnotationSchema>
export type AnnotationInput = z.infer<typeof ebookAnnotationInputSchema>
export type AnnotationUnit = AnnotationInput & {
    id: string
    userId: string
    textId: string
    annotations: EbookAnnotation[]
    complete: boolean
}
export const generatedEbookAnnotationSchema = z
    .object({
        quote: z.string().min(1).max(1024),
        occurrence: z.int().positive(),
        definition: ebookAnnotationSchema.shape.definition,
    })
    .strict()
export type GeneratedEbookAnnotation = z.infer<typeof generatedEbookAnnotationSchema>
export interface EbookAnnotationStore {
    get(id: string, userId: string, textId: string, signal: AbortSignal): Promise<AnnotationUnit | null>
    create(unit: AnnotationUnit, signal: AbortSignal): Promise<void>
    save(unit: AnnotationUnit, signal: AbortSignal): Promise<void>
}
export interface EbookAnnotationGenerator {
    lock(id: string): Promise<(() => Promise<void>) | null>
    charge(userId: string, limit: number, unitId: string, cost: number): Promise<boolean>
    generate(text: string, language: Lang, accent: string, signal: AbortSignal): AsyncIterable<GeneratedEbookAnnotation>
}
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

export function resolveEbookAnnotation(
    text: string,
    value: GeneratedEbookAnnotation,
    unitId: string,
): EbookAnnotation | null {
    let start = -1
    for (let index = 0; index < value.occurrence; index++) {
        start = text.indexOf(value.quote, start + 1)
        if (start < 0) return null
    }
    const boundaries = new Set([
        0,
        text.length,
        ...Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), (part) => part.index),
    ])
    if (!boundaries.has(start) || !boundaries.has(start + value.quote.length)) return null
    return {
        id: hash([unitId, start, value.quote]),
        quote: value.quote,
        start,
        length: value.quote.length,
        definition: value.definition,
    }
}

export function createEbookAnnotationOperations(dependencies: {
    catalog: CatalogStore
    ebooks: EbookStore
    store: EbookAnnotationStore
    definitions: DefinitionServices
    generator: EbookAnnotationGenerator
}) {
    const catalog = createCatalog(dependencies.catalog)
    const { store, definitions, generator } = dependencies
    async function authorize(context: MobileContext) {
        const textId = resourceID.parse(context.params.textId)
        const { text, library } = await catalog.authorizedText(context.subject, textId, context.signal)
        if (!text.has_ebook || text.bookmark_url) throw new MobileError('unsupported_format')
        return { textId, library }
    }
    const ebookAnnotations: MobileOperation = async (context) => {
        const input = ebookAnnotationInputSchema.parse(await jsonBody(context.request, 120000, context.signal))
        if (!input.text.trim()) throw new MobileError('invalid_input')
        const { textId, library } = await authorize(context)
        const asset = await dependencies.ebooks.asset(textId, context.signal)
        if (!asset || asset.sourceVersion !== input.sourceVersion) throw new MobileError('stale_revision')
        const { accent, limit } = await definitions.preferences(context.subject)
        const id = hash(['ebook-annotations-v1', context.subject.userId, textId, input, library.lang, accent])
        const existing = await store.get(id, context.subject.userId, textId, context.signal)
        const unit: AnnotationUnit = existing ?? {
            ...input,
            id,
            userId: context.subject.userId,
            textId,
            annotations: [],
            complete: false,
        }
        const abort = new AbortController()
        const signal = AbortSignal.any([context.signal, abort.signal])
        const encoder = new TextEncoder()
        const stream = new ReadableStream<Uint8Array>({
            async start(controller) {
                const emit = (frame: unknown) => {
                    signal.throwIfAborted()
                    controller.enqueue(encoder.encode(JSON.stringify(frame) + '\n'))
                }
                let release: (() => Promise<void>) | null = null
                try {
                    for (const annotation of unit.annotations) emit({ kind: 'annotation', unitId: id, annotation })
                    if (!unit.complete) {
                        release = await generator.lock(id)
                        if (!release) throw new MobileError('service_unavailable')
                        // Re-read after acquiring the lease: another device may have finished.
                        const latest = await store.get(id, unit.userId, textId, signal)
                        if (latest) {
                            for (const annotation of latest.annotations) {
                                if (!unit.annotations.some((item) => item.id === annotation.id))
                                    emit({ kind: 'annotation', unitId: id, annotation })
                            }
                            unit.annotations = latest.annotations
                            unit.complete = latest.complete
                        } else await store.create(unit, signal)
                        if (!unit.complete) {
                            const cost = (Array.from(input.text).length / 1000) * EBOOK_ANNOTATION_COST_PER_THOUSAND
                            if (!(await generator.charge(unit.userId, limit, id, cost)))
                                throw new MobileError('quota_exceeded')
                            let count = 0
                            for await (const output of generator.generate(input.text, library.lang, accent, signal)) {
                                signal.throwIfAborted()
                                if (++count > 48) throw new MobileError('service_unavailable')
                                const value = checkedResponse(generatedEbookAnnotationSchema, output)
                                const annotation = resolveEbookAnnotation(input.text, value, id)
                                if (
                                    !annotation ||
                                    unit.annotations.some(
                                        (item) =>
                                            annotation.start < item.start + item.length &&
                                            item.start < annotation.start + annotation.length,
                                    )
                                )
                                    continue
                                if (unit.annotations.length >= 48) break
                                if (Buffer.byteLength(JSON.stringify(annotation), 'utf8') > 60000)
                                    throw new MobileError('service_unavailable')
                                if (
                                    Buffer.byteLength(JSON.stringify([...unit.annotations, annotation]), 'utf8') >
                                    1_500_000
                                )
                                    break
                                unit.annotations.push(annotation)
                                // Persistence precedes publication; replay restores every emitted word.
                                await store.save(unit, signal)
                                emit({ kind: 'annotation', unitId: id, annotation })
                            }
                            unit.complete = true
                            await store.save(unit, signal)
                        }
                    }
                    emit({ kind: 'complete', unitId: id })
                } catch (error) {
                    if (!signal.aborted)
                        emit({
                            kind: 'failed',
                            unitId: id,
                            error: new MobileError(error instanceof MobileError ? error.code : 'service_unavailable')
                                .body.error,
                        })
                } finally {
                    if (release) await release().catch(() => {})
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
    const ebookAnnotationVocabulary: MobileOperation = async (context) => {
        const input = z
            .object({ unitId: resourceID, annotationId: resourceID, requestId: resourceID })
            .strict()
            .parse(await jsonBody(context.request, 16000, context.signal))
        const { textId, library } = await authorize(context)
        const unit = await store.get(input.unitId, context.subject.userId, textId, context.signal)
        const asset = await dependencies.ebooks.asset(textId, context.signal)
        if (!unit || !asset || asset.sourceVersion !== unit.sourceVersion) throw new MobileError('inaccessible')
        const annotation = unit.annotations.find((item) => item.id === input.annotationId)
        if (!annotation) throw new MobileError('inaccessible')
        return definitions.save(context.subject, library.id, library.lang, annotation.definition, input.requestId)
    }
    return { ebookAnnotations, ebookAnnotationVocabulary }
}
