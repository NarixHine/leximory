import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { isIP } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import { z } from 'zod'
import {
    guestAllowanceSchema,
    guestDefinitionInputSchema,
    guestDefinitionResultSchema,
    guestSessionSchema,
} from '@repo/api'
import type { Lang } from '@repo/schema/library'
import type { MobileErrorBody } from '@repo/schema/mobile'
import { checkedResponse, jsonBody, query, type PublicMobileOperation } from './http'
import { definitionResponse } from './definition-generation'
import { parseGeneratedDefinition, type CompletedDefinition } from './definitions'
import { MobileError } from './errors'

export const guestDefinitionLimit = 5
export const guestSessionLifetime = 30 * 86400
export const guestResultLifetime = 86400
export const guestGenerationLifetime = 90
export type GuestSession = { id: string; expiresAt: string }
export type GuestAllowance = z.infer<typeof guestAllowanceSchema>
export type GuestResult =
    | { state: 'running'; startedAt: number }
    | { state: 'completed'; language: Lang; definition: CompletedDefinition }
    | { state: 'failed'; error: MobileErrorBody['error'] }
export interface GuestStore {
    enroll(input: { network: string; tokenHash: string; session: GuestSession }): Promise<void>
    session(tokenHash: string): Promise<GuestSession | null>
    allowance(sessionId: string, window: GuestWindow): Promise<GuestAllowance>
    begin(input: GuestRequest): Promise<'new' | 'existing'>
    result(sessionId: string, requestId: string): Promise<GuestResult | null>
    finish(input: GuestRequest, result: Exclude<GuestResult, { state: 'running' }>, charged: boolean): Promise<void>
    revoke(tokenHash: string, sessionId: string): Promise<void>
}
export interface GuestWindow {
    day: string
    resetsAt: string
    expiresIn: number
}
export interface GuestRequest {
    sessionId: string
    requestId: string
    hash: string
    startedAt: number
    window: GuestWindow
}
export interface GuestDefinitionServices {
    cached(key: string): Promise<CompletedDefinition | null>
    cache(key: string, definition: CompletedDefinition): Promise<void>
    detectLanguage(context: string, quote: string): Promise<Lang>
    generate(context: string, language: Lang, accent: string, signal: AbortSignal): AsyncIterable<string>
}
export function guestWindow(now: number, expiresAt: string): GuestWindow {
    return {
        day: 'period',
        resetsAt: expiresAt,
        expiresIn: Math.max(1, Math.ceil((Date.parse(expiresAt) - now) / 1000)),
    }
}
export const guestDigest = (value: string) => createHash('sha256').update(value).digest('hex')
function tokenHash(request: Request): string {
    const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.headers.get('authorization') ?? '')?.[1]
    if (!token) throw new MobileError('unauthenticated')
    return guestDigest(token)
}
export function guestNetwork(request: Request): string {
    // Vercel overwrites this header. Untrusted forwarded-for and client-supplied IDs cannot create quota buckets.
    const ip = request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
    return guestDigest(ip && isIP(ip) ? ip : 'local-development')
}
export function createGuestOperations(dependencies: {
    store: GuestStore
    definitions: GuestDefinitionServices
    now?: () => number
}) {
    const { store, definitions } = dependencies
    const now = dependencies.now ?? Date.now
    async function authenticate(request: Request) {
        const hash = tokenHash(request)
        const session = await store.session(hash)
        if (!session || Date.parse(session.expiresAt) <= now()) throw new MobileError('unauthenticated')
        return { ...session, tokenHash: hash }
    }
    const failure = (error: unknown) =>
        new MobileError(error instanceof MobileError ? error.code : 'service_unavailable').body.error
    async function result(input: GuestRequest): Promise<GuestResult> {
        const value = await store.result(input.sessionId, input.requestId)
        if (!value) throw new MobileError('inaccessible')
        if (value.state === 'running' && value.startedAt + guestGenerationLifetime * 1000 < now()) {
            const failed = { state: 'failed', error: failure(new MobileError('service_unavailable')) } as const
            await store.finish(input, failed, false)
            return failed
        }
        return value
    }
    return {
        guestSession: async ({ request, signal }) => {
            query(request, [])
            z.object({})
                .strict()
                .parse(await jsonBody(request, 1024, signal))
            const token = randomBytes(32).toString('base64url')
            const session = { id: randomUUID(), expiresAt: new Date(now() + guestSessionLifetime * 1000).toISOString() }
            await store.enroll({ network: guestNetwork(request), tokenHash: guestDigest(token), session })
            return checkedResponse(guestSessionSchema, {
                token,
                expiresAt: session.expiresAt,
                allowance: await store.allowance(session.id, guestWindow(now(), session.expiresAt)),
            })
        },
        guestRevokeSession: async ({ request, signal }) => {
            const session = await authenticate(request)
            query(request, [])
            z.object({})
                .strict()
                .parse(await jsonBody(request, 1024, signal))
            await store.revoke(session.tokenHash, session.id)
            return { deleted: true }
        },
        guestDefinitionResult: async ({ request, params }) => {
            const session = await authenticate(request)
            query(request, [])
            const requestId = z.uuid().parse(params.requestId)
            const input = {
                sessionId: session.id,
                requestId,
                hash: '',
                startedAt: now(),
                window: guestWindow(now(), session.expiresAt),
            }
            const value = await result(input)
            const allowance = await store.allowance(session.id, input.window)
            return checkedResponse(
                guestDefinitionResultSchema,
                value.state === 'running'
                    ? { state: 'running', requestId, allowance }
                    : { ...value, requestId, allowance },
            )
        },
        guestDefinitions: async ({ request, signal }) => {
            const session = await authenticate(request)
            query(request, [])
            const input = guestDefinitionInputSchema.parse(await jsonBody(request, 32768, signal))
            if (input.context.slice(input.offset, input.offset + input.quote.length) !== input.quote)
                throw new MobileError('invalid_input')
            const claim: GuestRequest = {
                sessionId: session.id,
                requestId: input.requestId,
                hash: guestDigest(JSON.stringify(input)),
                startedAt: now(),
                window: guestWindow(now(), session.expiresAt),
            }
            const status = await store.begin(claim)
            const context =
                input.context.slice(0, input.offset) +
                '[[' +
                input.quote +
                ']]' +
                input.context.slice(input.offset + input.quote.length)
            const generate = async (
                generationSignal: AbortSignal,
                delta?: (text: string) => void,
            ): Promise<CompletedDefinition> => {
                if (status === 'existing') {
                    while (true) {
                        generationSignal.throwIfAborted()
                        const value = await result(claim)
                        if (value.state === 'completed') return value.definition
                        if (value.state === 'failed') throw new MobileError(value.error.code)
                        await delay(150, undefined, { signal: generationSignal })
                    }
                }
                try {
                    const language = input.language ?? (await definitions.detectLanguage(context, input.quote))
                    generationSignal.throwIfAborted()
                    const cacheKey = guestDigest(
                        JSON.stringify(['guest-definition-v1', language, input.accent, context]),
                    )
                    const cached = await definitions.cached(cacheKey)
                    let definition = cached
                    if (!definition) {
                        let raw = ''
                        for await (const text of definitions.generate(
                            context,
                            language,
                            input.accent,
                            generationSignal,
                        )) {
                            generationSignal.throwIfAborted()
                            raw += text
                            if (raw.length > 32000) throw new MobileError('service_unavailable')
                            delta?.(text)
                        }
                        generationSignal.throwIfAborted()
                        definition = parseGeneratedDefinition(raw)
                    }
                    await store.finish(claim, { state: 'completed', language, definition }, cached === null)
                    // The recoverable result is already committed. An optional cache failure must not erase it.
                    if (!cached) await definitions.cache(cacheKey, definition).catch(() => {})
                    return definition
                } catch (error) {
                    await store.finish(claim, { state: 'failed', error: failure(error) }, false)
                    throw error
                }
            }
            return definitionResponse({ requestId: input.requestId, signal, generate, complete: async () => {} })
        },
    } satisfies Record<string, PublicMobileOperation>
}
