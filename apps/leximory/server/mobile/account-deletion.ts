import { createHash, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { accountDeletionInputSchema, accountDeletionStatusSchema } from '@repo/api'
import { checkedResponse, jsonBody, query, type MobileOperation } from './http'
import { MobileError, mobileErrorResponse } from './errors'

export const deletionRecordSchema = accountDeletionStatusSchema
    .extend({
        userId: z.uuid(),
        receiptDigest: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict()
export type DeletionRecord = z.infer<typeof deletionRecordSchema>
export interface AccountDeletionStore {
    begin(record: DeletionRecord): Promise<DeletionRecord>
    read(requestId: string): Promise<DeletionRecord | null>
    freeze(record: DeletionRecord): Promise<void>
    enqueue(record: DeletionRecord): Promise<void>
}

const authenticationClaims = z.object({
    sub: z.uuid(),
    amr: z.array(z.object({ method: z.string(), timestamp: z.number() })),
})
export function requireRecentAuthentication(token: string, userId: string, now = Date.now()): void {
    let claims: z.infer<typeof authenticationClaims>
    try {
        const payload = token.split('.')[1]
        if (!payload) throw new Error('Missing verified claims')
        claims = authenticationClaims.parse(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')))
    } catch {
        throw new MobileError('reauthentication_required')
    }
    const seconds = now / 1000
    if (
        claims.sub !== userId ||
        !claims.amr.some(
            (method) =>
                method.method !== 'token_refresh' &&
                method.timestamp >= seconds - 600 &&
                method.timestamp <= seconds + 60,
        )
    )
        throw new MobileError('reauthentication_required')
}

export function receiptDigest(token: string): string {
    return createHash('sha256').update(token).digest('hex')
}
function bearer(request: Request): string {
    const token = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(request.headers.get('authorization') ?? '')?.[1]
    if (!token) throw new MobileError('unauthenticated')
    return token
}
function status(record: DeletionRecord) {
    return checkedResponse(accountDeletionStatusSchema, { requestId: record.requestId, status: record.status })
}

export function createAccountDeletionOperations(store: AccountDeletionStore, now = Date.now) {
    return {
        accountDeletion: async ({ request, subject, signal }) => {
            query(request, [])
            const input = accountDeletionInputSchema.parse(await jsonBody(request, 2048, signal))
            if (input.expectedUserId !== subject.userId) throw new MobileError('invalid_input')
            const existing = await store.read(input.requestId)
            const digest = receiptDigest(input.receiptToken)
            if (existing) {
                if (existing.userId !== subject.userId || existing.receiptDigest !== digest)
                    throw new MobileError('invalid_input')
                if (existing.status !== 'completed') {
                    await store.freeze(existing)
                    await store.enqueue(existing)
                }
                return status(existing.status === 'completed' ? existing : { ...existing, status: 'pending' })
            }
            // The caller's bearer has already been verified by the ordinary mobile auth boundary.
            requireRecentAuthentication(bearer(request), subject.userId, now())
            const record = await store.begin({
                requestId: input.requestId,
                userId: z.uuid().parse(subject.userId),
                receiptDigest: digest,
                status: 'pending',
            })
            await store.freeze(record)
            await store.enqueue(record)
            return status(record)
        },
    } satisfies Record<string, MobileOperation>
}

export function createAccountDeletionReceiptEndpoint(store: AccountDeletionStore, retry: boolean) {
    return async (request: Request, context: { params: Promise<Record<string, string>> }): Promise<Response> => {
        try {
            query(request, [])
            if (retry && request.body) throw new MobileError('invalid_input')
            const { requestId } = z
                .object({ requestId: z.uuid() })
                .strict()
                .parse(await context.params)
            const digest = receiptDigest(bearer(request))
            const record = await store.read(requestId)
            if (!record || !timingSafeEqual(Buffer.from(record.receiptDigest, 'hex'), Buffer.from(digest, 'hex')))
                throw new MobileError('inaccessible')
            if (retry && record.status !== 'completed') {
                await store.freeze(record)
                await store.enqueue(record)
                return Response.json(status({ ...record, status: 'pending' }), {
                    headers: { 'Cache-Control': 'private, no-store' },
                })
            }
            return Response.json(status(record), { headers: { 'Cache-Control': 'private, no-store' } })
        } catch (error) {
            return mobileErrorResponse(error)
        }
    }
}
