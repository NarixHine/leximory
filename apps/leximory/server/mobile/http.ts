import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { resourceID } from '@repo/api'
import type { MobileSubject } from '@repo/schema/mobile'
import { requireMobileSubject, type BearerVerifier } from './auth'
import { MobileError, mobileErrorResponse } from './errors'

export interface MobileContext {
    request: Request
    subject: MobileSubject
    signal: AbortSignal
    params: Record<string, string>
    traceId: string
}
export type MobileOperation = (context: MobileContext) => Promise<unknown>

export function mobileEndpoint(verify: BearerVerifier, operation: MobileOperation, timeout = 20000) {
    return async (
        request: Request,
        context: { params: Promise<Record<string, string>> } = { params: Promise.resolve({}) },
    ): Promise<Response> => {
        const supplied = request.headers.get('X-Leximory-Request-ID')
        const traceId = supplied && /^[a-zA-Z0-9-]{1,64}$/.test(supplied) ? supplied : randomUUID()
        try {
            const subject = await requireMobileSubject(request, verify)
            const params = z.record(z.string(), resourceID).parse(await context.params)
            const signal = AbortSignal.any([request.signal, AbortSignal.timeout(timeout)])
            signal.throwIfAborted()
            const result = await operation({ request, subject, signal, params, traceId })
            signal.throwIfAborted()
            const response = result instanceof Response ? result : Response.json(result)
            response.headers.set('Cache-Control', 'private, no-store')
            response.headers.set('X-Leximory-Request-ID', traceId)
            return response
        } catch (error) {
            const response = mobileErrorResponse(error)
            response.headers.set('X-Leximory-Request-ID', traceId)
            return response
        }
    }
}

export async function bodyBytes(
    request: Request,
    maxBytes: number,
    signal = request.signal,
): Promise<Uint8Array<ArrayBuffer>> {
    const length = Number(request.headers.get('content-length') ?? 0)
    if (!Number.isFinite(length) || length < 0 || length > maxBytes) throw new MobileError('invalid_input')
    const reader = request.body?.getReader()
    if (!reader) throw new MobileError('invalid_input')
    const chunks: Uint8Array[] = []
    let size = 0
    const abort = () => {
        void reader.cancel().catch(() => {})
    }
    signal.addEventListener('abort', abort, { once: true })
    try {
        signal.throwIfAborted()
        while (true) {
            const { value, done } = await reader.read()
            signal.throwIfAborted()
            if (done) break
            size += value.byteLength
            if (size > maxBytes) {
                await reader.cancel()
                throw new MobileError('invalid_input')
            }
            chunks.push(value)
        }
        if (!size) throw new MobileError('invalid_input')
        return new Uint8Array(Buffer.concat(chunks))
    } finally {
        signal.removeEventListener('abort', abort)
        reader.releaseLock()
    }
}

export async function jsonBody(request: Request, maxBytes = 8192, signal = request.signal): Promise<unknown> {
    const bytes = await bodyBytes(request, maxBytes, signal)
    try {
        return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    } catch {
        throw new MobileError('invalid_input')
    }
}

export function query(request: Request, allowed: string[]): Record<string, string> {
    const parameters = new URL(request.url).searchParams
    const entries: Record<string, string> = {}
    for (const [key, value] of parameters) {
        if (!allowed.includes(key) || Object.hasOwn(entries, key)) throw new MobileError('invalid_input')
        entries[key] = value
    }
    return entries
}

export function checkedResponse<T>(schema: z.ZodType<T>, value: unknown): T {
    const parsed = schema.safeParse(value)
    if (!parsed.success) throw new MobileError('service_unavailable')
    return parsed.data
}
