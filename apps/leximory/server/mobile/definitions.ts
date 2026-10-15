import { randomUUID, createHash } from 'node:crypto'
import { z } from 'zod'
import { definitionSchema, vocabularyInputSchema, ebookSelectionSchema, resourceID } from '@repo/api'
import { occurrenceSchema, type MobileSubject, type Occurrence } from '@repo/schema/mobile'
import type { Lang } from '@repo/schema/library'
import { createCatalog, type CatalogStore } from './catalog'
import { renderDocument, resolveOccurrence, OccurrenceError } from './render-document'
import { MobileError } from './errors'
import { checkedResponse, jsonBody, type MobileContext, type MobileOperation } from './http'
import { prepareDefinition, definitionResponse } from './definition-generation'

export type CompletedDefinition = z.infer<typeof definitionSchema>
export const receiptSchema = z
    .object({ subject: z.string(), occurrence: occurrenceSchema, definition: definitionSchema })
    .strict()
export type Receipt = z.infer<typeof receiptSchema>
export interface DefinitionServices {
    preferences(subject: MobileSubject): Promise<{ accent: string; limit: number }>
    cached(key: string): Promise<CompletedDefinition | null>
    cache(key: string, definition: CompletedDefinition): Promise<void>
    charge(subject: MobileSubject, limit: number, requestId?: string): Promise<boolean>
    generate(context: string, language: Lang, accent: string, signal: AbortSignal): AsyncIterable<string>
    complete(id: string, receipt: Receipt): Promise<void>
    receipt(id: string): Promise<Receipt | null>
    save(
        subject: MobileSubject,
        sourceLibrary: string,
        language: Lang,
        definition: CompletedDefinition,
        requestId: string,
    ): Promise<{ id: string; libraryId: string }>
}
export function parseGeneratedDefinition(value: string): CompletedDefinition {
    const match = /^\s*\{\{([^{}]+)\}\}\s*$/.exec(value)
    const portions = match?.[1]?.split('||').map((value) => value.trim())
    if (!portions || portions.length < 3 || portions.length > 5 || portions.some((value) => !value))
        throw new MobileError('service_unavailable')
    return checkedResponse(definitionSchema, {
        lemma: portions[1],
        definition: portions[2],
        etymology: portions[3] ?? null,
        cognates: portions[4] ?? null,
    })
}
function occurrence(document: ReturnType<typeof renderDocument>, input: unknown, textId: string) {
    try {
        const resolved = resolveOccurrence(document, input)
        if (
            resolved.occurrence.textId !== textId ||
            resolved.selectedText.length > 1024 ||
            resolved.context.length > 30000
        )
            throw new MobileError('invalid_input')
        return resolved
    } catch (error) {
        if (error instanceof OccurrenceError) throw new MobileError(error.code)
        throw error
    }
}
export function createDefinitionOperations(dependencies: {
    store: CatalogStore
    services: DefinitionServices
    requestID?: () => string
}) {
    const { services } = dependencies
    const catalog = createCatalog(dependencies.store)
    async function selection(context: MobileContext, ebook: boolean) {
        const textId = resourceID.parse(context.params.textId)
        const { text, library } = await catalog.authorizedText(context.subject, textId, context.signal)
        if (text.bookmark_url || text.has_ebook !== ebook) throw new MobileError('unsupported_format')
        return { textId, text, library }
    }
    function definitions(ebook: boolean): MobileOperation {
        return async (context) => {
            const body = await jsonBody(context.request, 32768, context.signal)
            const { textId, text, library } = await selection(context, ebook)
            const resolved = (() => {
                if (ebook) {
                    const { quote, context: source, offset } = ebookSelectionSchema.parse(body)
                    if (source.slice(offset, offset + quote.length) !== quote) throw new MobileError('invalid_input')
                    const revision = createHash('sha256').update(source).digest('hex')
                    return {
                        occurrence: {
                            textId,
                            revision,
                            blockId: 'ebook-selection',
                            range: { location: offset, length: quote.length },
                        },
                        context: source.slice(0, offset) + '[[' + quote + ']]' + source.slice(offset + quote.length),
                    }
                }
                const input = occurrenceSchema.omit({ textId: true }).parse(body)
                return occurrence(renderDocument(text.content), { textId, ...input }, textId)
            })()
            const generate = await prepareDefinition(services, {
                subject: context.subject,
                language: library.lang,
                context: resolved.context,
                cacheVersion: 'mobile-definition-v3',
                signal: context.signal,
            })
            const requestId = dependencies.requestID?.() ?? randomUUID()
            return definitionResponse({
                requestId,
                signal: context.signal,
                generate,
                complete: (definition) =>
                    services.complete(requestId, {
                        subject: context.subject.userId,
                        occurrence: resolved.occurrence,
                        definition,
                    }),
            })
        }
    }
    return {
        definitions: definitions(false),
        ebookDefinitions: definitions(true),
        vocabulary: async (context) => {
            const input = vocabularyInputSchema.parse(await jsonBody(context.request, 32768, context.signal))
            const { textId, text, library } = await selection(context, false)
            const document = renderDocument(text.content)
            const resolved = occurrence(document, input.occurrence, textId)
            let definition: CompletedDefinition
            if (input.completionId) {
                const receipt = await services.receipt(input.completionId)
                if (
                    !receipt ||
                    receipt.subject !== context.subject.userId ||
                    JSON.stringify(receipt.occurrence) !== JSON.stringify(resolved.occurrence)
                )
                    throw new MobileError('invalid_input')
                definition = receipt.definition
            } else {
                const span = document.blocks
                    .find((block) => block.id === resolved.occurrence.blockId)
                    ?.spans.find(
                        (span) =>
                            span.kind === 'definition' &&
                            span.range.location === resolved.occurrence.range.location &&
                            span.range.length === resolved.occurrence.range.length,
                    )
                if (!span || span.kind !== 'definition') throw new MobileError('invalid_input')
                definition = definitionSchema.parse({
                    lemma: span.lemma,
                    definition: span.definition,
                    etymology: span.etymology,
                    cognates: span.cognates,
                })
            }
            return services.save(context.subject, library.id, library.lang, definition, input.requestId)
        },
        ebookVocabulary: async (context) => {
            const input = z
                .object({ completionId: resourceID, requestId: resourceID })
                .strict()
                .parse(await jsonBody(context.request, 32768, context.signal))
            const { textId, library } = await selection(context, true)
            const receipt = await services.receipt(input.completionId)
            if (
                !receipt ||
                receipt.subject !== context.subject.userId ||
                receipt.occurrence.textId !== textId ||
                receipt.occurrence.blockId !== 'ebook-selection'
            )
                throw new MobileError('invalid_input')
            return services.save(context.subject, library.id, library.lang, receipt.definition, input.requestId)
        },
    } satisfies Record<string, MobileOperation>
}
