import { randomUUID, createHash } from 'node:crypto'
import { isIP } from 'node:net'
import { z } from 'zod'
import { browserSelectionSchema, browserTargetSchema, bookmarkInputSchema, domainRuleSchema, resourceID, definitionSchema, textSchema } from '@repo/api'
import { LangSchema, type Lang } from '@repo/schema/library'
import type { MobileSubject } from '@repo/schema/mobile'
import { createCatalog, type CatalogStore, type LibraryRow } from './catalog'
import { canWriteLibrary } from '@repo/service/access'
import { requireMobileSubject, type BearerVerifier } from './auth'
import { jsonBody, parseGeneratedDefinition, type DefinitionServices } from './definitions'
import { MobileError, mobileErrorResponse } from './errors'

const sourceSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('bookmark'), id: resourceID, libraryId: resourceID }),
    z.object({ kind: z.literal('library'), libraryId: resourceID }),
    z.object({ kind: z.literal('shadow') }),
])
export const browserReceiptSchema = z.object({
    subject: z.string(), language: LangSchema, source: sourceSchema, context: z.string(),
    libraryName: z.string(), definition: definitionSchema.optional(),
})
export type BrowserReceipt = z.infer<typeof browserReceiptSchema>
export interface BrowserStore {
    detectLanguage(context: string): Promise<Lang>
    rules(userId: string): Promise<z.infer<typeof domainRuleSchema>[]>
    setRule(userId: string, domain: string, libraryId: string | null): Promise<void>
    putReceipt(id: string, receipt: BrowserReceipt): Promise<void>
    receipt(id: string): Promise<BrowserReceipt | null>
    shadowLibrary(subject: MobileSubject, language: Lang): Promise<string>
    bookmark(subject: MobileSubject, library: LibraryRow, input: z.infer<typeof bookmarkInputSchema>): Promise<z.infer<typeof textSchema>>
}
export function browserURL(input: string): URL {
    const url = new URL(input)
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw new MobileError('invalid_input')
    return url
}
export function browserDomain(input: string): string {
    const url = browserURL(input.includes('://') ? input : 'https://' + input)
    if (url.port || url.pathname !== '/' || url.search || url.hash) throw new MobileError('invalid_input')
    const domain = url.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '')
    const ipv6 = domain.startsWith('[') && domain.endsWith(']') && isIP(domain.slice(1, -1)) === 6
    const validHostname = ipv6 || /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(domain)
    if (!validHostname || domain.length > 253) throw new MobileError('invalid_input')
    return domain
}
export function createBrowserHandler(dependencies: { verify: BearerVerifier; catalog: CatalogStore; browser: BrowserStore; definitions: DefinitionServices }) {
    const catalog = createCatalog(dependencies.catalog)
    const store = dependencies.browser
    const services = dependencies.definitions
    async function checkedReceipt(id: string, subject: MobileSubject, signal: AbortSignal) {
        const receipt = await store.receipt(id)
        if (!receipt || receipt.subject !== subject.userId) throw new MobileError('invalid_input')
        if (receipt.source.kind === 'bookmark') {
            const { text, library } = await catalog.authorizedText(subject, receipt.source.id, signal)
            if (!text.bookmark_url || library.id !== receipt.source.libraryId || library.lang !== receipt.language) throw new MobileError('stale_revision')
        } else if (receipt.source.kind === 'library') {
            const library = await catalog.authorizedLibrary(subject, receipt.source.libraryId, signal)
            if (!canWriteLibrary(subject, library) || library.lang !== receipt.language) throw new MobileError('inaccessible')
        }
        return receipt
    }
    return async (request: Request): Promise<Response> => {
        try {
            const subject = await requireMobileSubject(request, dependencies.verify)
            const path = new URL(request.url).pathname
            const signal = AbortSignal.any([request.signal, AbortSignal.timeout(60000)])
            const json = (value: unknown) => Response.json(value, { headers: { 'Cache-Control': 'private, no-store' } })
            if (path.endsWith('/browser/rules')) {
                if (request.method === 'GET') return json({ items: z.array(domainRuleSchema).parse(await store.rules(subject.userId)) })
                if (request.method !== 'POST') throw new MobileError('inaccessible')
                const input = z.object({ domain: z.string().max(253), libraryId: resourceID.nullable() }).strict().parse(await jsonBody(request))
                const domain = browserDomain(input.domain)
                if (input.libraryId) {
                    const library = await catalog.authorizedLibrary(subject, input.libraryId, signal)
                    if (!canWriteLibrary(subject, library)) throw new MobileError('inaccessible')
                }
                await store.setRule(subject.userId, domain, input.libraryId)
                return json({ saved: true })
            }
            if (request.method !== 'POST') throw new MobileError('inaccessible')
            const bookmark = /\/libraries\/([A-Za-z0-9_-]{1,128})\/bookmarks$/.exec(path)
            if (bookmark?.[1]) {
                const library = await catalog.authorizedLibrary(subject, bookmark[1], signal)
                if (!canWriteLibrary(subject, library) || library.shadow) throw new MobileError('inaccessible')
                const input = bookmarkInputSchema.parse(await jsonBody(request))
                browserURL(input.url)
                return json(textSchema.parse(await store.bookmark(subject, library, input)))
            }
            if (path.endsWith('/browser/selection')) {
                const input = browserSelectionSchema.parse(await jsonBody(request, 32768))
                const url = browserURL(input.url)
                if (input.context.slice(input.offset, input.offset + input.quote.length) !== input.quote) throw new MobileError('invalid_input')
                let library: LibraryRow | null = null
                let source: BrowserReceipt['source'] = { kind: 'shadow' }
                if (input.bookmarkId) {
                    const authorized = await catalog.authorizedText(subject, input.bookmarkId, signal)
                    if (!authorized.text.bookmark_url) throw new MobileError('unsupported_format')
                    library = authorized.library
                    source = { kind: 'bookmark', id: input.bookmarkId, libraryId: library.id }
                } else {
                    const rule = input.libraryId ?? (await store.rules(subject.userId)).find(rule => rule.domain === browserDomain(url.hostname))?.libraryId
                    if (rule) {
                        const candidate = await dependencies.catalog.library(rule, signal)
                        if (candidate && canWriteLibrary(subject, candidate)) {
                            library = candidate
                            source = { kind: 'library', libraryId: candidate.id }
                        } else if (input.libraryId) throw new MobileError('inaccessible')
                    }
                }
                // Explicit library choices always win. Jev is only the fallback.
                const context = input.context.slice(0, input.offset) + '[[' + input.quote + ']]' + input.context.slice(input.offset + input.quote.length)
                const language = library?.lang ?? await store.detectLanguage(context)
                const shadow = !library || library.owner !== subject.userId
                const libraryName = !shadow && library ? library.name : ({ en: '英语', zh: '中文', fr: '法语', ja: '日语', nl: '荷兰语' }[language] + '词汇仓库')
                const selectionId = randomUUID()
                await store.putReceipt(selectionId, { subject: subject.userId, language, source, context, libraryName })
                return json(browserTargetSchema.parse({ selectionId, language, libraryId: !shadow && library ? library.id : null, libraryName, shadow }))
            }
            if (path.endsWith('/browser/vocabulary')) {
                const input = z.object({ completionId: resourceID, requestId: resourceID }).strict().parse(await jsonBody(request))
                const receipt = await checkedReceipt(input.completionId, subject, signal)
                if (!receipt.definition) throw new MobileError('invalid_input')
                const sourceLibrary = receipt.source.kind === 'shadow'
                    ? await store.shadowLibrary(subject, receipt.language) : receipt.source.libraryId
                return json(await services.save(subject, sourceLibrary, receipt.language, receipt.definition, input.requestId))
            }
            if (!path.endsWith('/browser/definitions')) throw new MobileError('inaccessible')
            const input = z.object({ selectionId: resourceID }).strict().parse(await jsonBody(request))
            const receipt = await checkedReceipt(input.selectionId, subject, signal)
            const preferences = await services.preferences(subject)
            const key = createHash('sha256').update(JSON.stringify(['browser-definition-v1', receipt.language, preferences.accent, receipt.context])).digest('hex')
            const cached = await services.cached(key)
            if (!cached && !await services.charge(subject, preferences.limit)) throw new MobileError('quota_exceeded')
            const requestId = randomUUID()
            const abort = new AbortController()
            const streamSignal = AbortSignal.any([signal, abort.signal])
            const encoder = new TextEncoder()
            const stream = new ReadableStream<Uint8Array>({
                async start(controller) {
                    const emit = (value: unknown) => { streamSignal.throwIfAborted(); controller.enqueue(encoder.encode(JSON.stringify(value) + '\n')) }
                    try {
                        emit({ kind: 'started', requestId })
                        let definition = cached
                        if (!definition) {
                            let generated = ''
                            for await (const delta of services.generate(receipt.context, receipt.language, preferences.accent, streamSignal)) {
                                generated += delta
                                if (generated.length > 32000) throw new MobileError('service_unavailable')
                                emit({ kind: 'delta', requestId, text: delta })
                            }
                            streamSignal.throwIfAborted()
                            definition = parseGeneratedDefinition(generated)
                            await services.cache(key, definition)
                        }
                        await store.putReceipt(requestId, { ...receipt, definition })
                        emit({ kind: 'completed', requestId, definition })
                    } catch (error) {
                        if (!streamSignal.aborted) emit({ kind: 'failed', requestId, error: new MobileError(error instanceof MobileError ? error.code : 'service_unavailable').body.error })
                    } finally { if (!abort.signal.aborted) controller.close() }
                },
                cancel() { abort.abort() },
            })
            return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'private, no-store', 'X-Accel-Buffering': 'no' } })
        } catch (error) { return mobileErrorResponse(error instanceof z.ZodError || error instanceof SyntaxError || error instanceof TypeError ? new MobileError('invalid_input') : error) }
    }
}
