import { randomUUID } from 'node:crypto'
import { isIP } from 'node:net'
import { z } from 'zod'
import {
    browserSelectionSchema,
    browserTargetSchema,
    bookmarkInputSchema,
    domainRuleSchema,
    resourceID,
    definitionSchema,
    textSchema,
} from '@repo/api'
import { LangSchema, type Lang } from '@repo/schema/library'
import type { MobileSubject } from '@repo/schema/mobile'
import { createCatalog, type CatalogStore, type LibraryRow } from './catalog'
import { getLanguageName } from '@repo/languages'
import { canWriteLibrary } from '@repo/service/access'
import type { DefinitionServices } from './definitions'
import { jsonBody, checkedResponse, type MobileOperation } from './http'
import { prepareDefinition, definitionResponse } from './definition-generation'
import { MobileError } from './errors'

const sourceSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('bookmark'), id: resourceID, libraryId: resourceID }),
    z.object({ kind: z.literal('library'), libraryId: resourceID }),
    z.object({ kind: z.literal('shadow') }),
])
export const browserReceiptSchema = z.object({
    subject: z.string(),
    language: LangSchema,
    source: sourceSchema,
    context: z.string(),
    libraryName: z.string(),
    definition: definitionSchema.optional(),
})
export type BrowserReceipt = z.infer<typeof browserReceiptSchema>
export interface BrowserStore {
    detectLanguage(context: string, quote: string): Promise<Lang>
    rules(userId: string): Promise<z.infer<typeof domainRuleSchema>[]>
    setRule(userId: string, domain: string, libraryId: string | null): Promise<void>
    putReceipt(id: string, receipt: BrowserReceipt): Promise<void>
    receipt(id: string): Promise<BrowserReceipt | null>
    shadowLibrary(subject: MobileSubject, language: Lang): Promise<string>
    bookmark(
        subject: MobileSubject,
        library: LibraryRow,
        input: z.infer<typeof bookmarkInputSchema>,
    ): Promise<z.infer<typeof textSchema>>
}
export function browserURL(input: string): URL {
    let url: URL
    try {
        url = new URL(input)
    } catch {
        throw new MobileError('invalid_input')
    }
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password)
        throw new MobileError('invalid_input')
    return url
}
export function browserDomain(input: string): string {
    const url = browserURL(input.includes('://') ? input : 'https://' + input)
    if (url.port || url.pathname !== '/' || url.search || url.hash) throw new MobileError('invalid_input')
    const domain = url.hostname
        .toLowerCase()
        .replace(/^www\./, '')
        .replace(/\.$/, '')
    const ipv6 = domain.startsWith('[') && domain.endsWith(']') && isIP(domain.slice(1, -1)) === 6
    const validHostname =
        ipv6 || /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(domain)
    if (!validHostname || domain.length > 253) throw new MobileError('invalid_input')
    return domain
}
export function createBrowserOperations(dependencies: {
    catalog: CatalogStore
    browser: BrowserStore
    definitions: DefinitionServices
}) {
    const catalog = createCatalog(dependencies.catalog)
    const store = dependencies.browser
    const services = dependencies.definitions
    async function checkedReceipt(id: string, subject: MobileSubject, signal: AbortSignal) {
        const receipt = await store.receipt(id)
        if (!receipt || receipt.subject !== subject.userId) throw new MobileError('invalid_input')
        if (receipt.source.kind === 'bookmark') {
            const { text, library } = await catalog.authorizedText(subject, receipt.source.id, signal)
            if (!text.bookmark_url || library.id !== receipt.source.libraryId || library.lang !== receipt.language)
                throw new MobileError('stale_revision')
        } else if (receipt.source.kind === 'library') {
            const library = await catalog.authorizedLibrary(subject, receipt.source.libraryId, signal)
            if (!canWriteLibrary(subject, library) || library.lang !== receipt.language)
                throw new MobileError('inaccessible')
        }
        return receipt
    }
    return {
        browserRules: async ({ subject }) => ({
            items: checkedResponse(z.array(domainRuleSchema), await store.rules(subject.userId)),
        }),
        browserRule: async ({ request, subject, signal }) => {
            const input = z
                .object({ domain: z.string().max(253), libraryId: resourceID.nullish() })
                .strict()
                .parse(await jsonBody(request, 8192, signal))
            const domain = browserDomain(input.domain)
            if (input.libraryId) {
                const library = await catalog.authorizedLibrary(subject, input.libraryId, signal)
                if (!canWriteLibrary(subject, library)) throw new MobileError('inaccessible')
            }
            await store.setRule(subject.userId, domain, input.libraryId ?? null)
            return { saved: true }
        },
        createBookmark: async ({ request, subject, signal, params }) => {
            const library = await catalog.authorizedLibrary(subject, resourceID.parse(params.libraryId), signal)
            if (!canWriteLibrary(subject, library) || library.shadow) throw new MobileError('inaccessible')
            const input = bookmarkInputSchema.parse(await jsonBody(request, 8192, signal))
            browserURL(input.url)
            return checkedResponse(textSchema, await store.bookmark(subject, library, input))
        },
        browserSelection: async ({ request, subject, signal, traceId }) => {
            const input = browserSelectionSchema.parse(await jsonBody(request, 32768, signal))
            const url = browserURL(input.url)
            if (input.context.slice(input.offset, input.offset + input.quote.length) !== input.quote)
                throw new MobileError('invalid_input')
            let library: LibraryRow | null = null
            let source: BrowserReceipt['source'] = { kind: 'shadow' }
            if (input.bookmarkId) {
                const authorized = await catalog.authorizedText(subject, input.bookmarkId, signal)
                if (!authorized.text.bookmark_url) throw new MobileError('unsupported_format')
                library = authorized.library
                source = { kind: 'bookmark', id: input.bookmarkId, libraryId: library.id }
            } else {
                const rule =
                    input.libraryId ??
                    (await store.rules(subject.userId)).find((rule) => rule.domain === browserDomain(url.hostname))
                        ?.libraryId
                if (rule) {
                    const candidate = await dependencies.catalog.library(rule, signal)
                    if (candidate && canWriteLibrary(subject, candidate)) {
                        library = candidate
                        source = { kind: 'library', libraryId: candidate.id }
                    } else if (input.libraryId) throw new MobileError('inaccessible')
                }
            }
            const context =
                input.context.slice(0, input.offset) +
                '[[' +
                input.quote +
                ']]' +
                input.context.slice(input.offset + input.quote.length)
            let language: Lang
            try {
                language = library?.lang ?? (await store.detectLanguage(context, input.quote))
            } catch (error) {
                console.error('mobile.browser.failed', {
                    traceId,
                    stage: 'selection-language',
                    code: error instanceof MobileError ? error.code : 'service_unavailable',
                    errorType: error instanceof Error ? error.name : 'unknown',
                })
                throw error
            }
            const shadow = !library || library.owner !== subject.userId
            const libraryName = !shadow && library ? library.name : getLanguageName(language) + '词汇仓库'
            const selectionId = randomUUID()
            await store.putReceipt(selectionId, { subject: subject.userId, language, source, context, libraryName })
            return checkedResponse(browserTargetSchema, {
                selectionId,
                language,
                libraryId: !shadow && library ? library.id : null,
                libraryName,
                shadow,
            })
        },
        browserVocabulary: async ({ request, subject, signal }) => {
            const input = z
                .object({ completionId: resourceID, requestId: resourceID })
                .strict()
                .parse(await jsonBody(request, 8192, signal))
            const receipt = await checkedReceipt(input.completionId, subject, signal)
            if (!receipt.definition) throw new MobileError('invalid_input')
            const sourceLibrary =
                receipt.source.kind === 'shadow'
                    ? await store.shadowLibrary(subject, receipt.language)
                    : receipt.source.libraryId
            return services.save(subject, sourceLibrary, receipt.language, receipt.definition, input.requestId)
        },
        browserDefinitions: async ({ request, subject, signal }) => {
            const input = z
                .object({ selectionId: resourceID })
                .strict()
                .parse(await jsonBody(request, 8192, signal))
            const receipt = await checkedReceipt(input.selectionId, subject, signal)
            const generate = await prepareDefinition(services, {
                subject,
                language: receipt.language,
                context: receipt.context,
                cacheVersion: 'browser-definition-v1',
                signal,
            })
            const requestId = randomUUID()
            return definitionResponse({
                requestId,
                signal,
                generate,
                complete: (definition) => store.putReceipt(requestId, { ...receipt, definition }),
            })
        },
    } satisfies Record<string, MobileOperation>
}
