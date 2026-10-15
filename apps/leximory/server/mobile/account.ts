import { z } from 'zod'
import { accountSettingsSchema, avatarInputSchema } from '@repo/api'
import { MAX_AVATAR_SIZE } from '@repo/env/content'
import type { MobileSubject } from '@repo/schema/mobile'
import { MobileError } from './errors'
import { checkedResponse, jsonBody, query, type MobileContext, type MobileOperation } from './http'

const accentInput = z.object({ accent: z.enum(['BrE', 'AmE']) }).strict()
const checkoutInput = z.object({ plan: z.enum(['bilingual', 'polyglot']) }).strict()
const urlResponse = z.object({ url: z.url() })
const tokenResponse = z.object({ token: z.string().min(1) })
const claimResponse = z.object({ message: z.string().min(1) })

export interface AccountScope {
    subject: MobileSubject
    signal: AbortSignal
}

export interface AccountStore {
    settings(scope: AccountScope): Promise<z.infer<typeof accountSettingsSchema>>
    accent(scope: AccountScope, accent: z.infer<typeof accentInput>['accent']): Promise<void>
    claim(scope: AccountScope): Promise<string>
    token(scope: AccountScope): Promise<string>
    revoke(scope: AccountScope): Promise<void>
    avatar(
        scope: AccountScope,
        bytes: Uint8Array,
        contentType: z.infer<typeof avatarInputSchema>['contentType'],
    ): Promise<string>
    checkout(scope: AccountScope, plan: z.infer<typeof checkoutInput>['plan']): Promise<string>
    billing(scope: AccountScope): Promise<string>
}

function scope({ subject, signal }: MobileContext): AccountScope {
    return { subject, signal }
}

function noBody(request: Request) {
    if (request.body || Number(request.headers.get('content-length') ?? 0) !== 0) throw new MobileError('invalid_input')
}

export function createAccountOperations(store: AccountStore) {
    return {
        accountSettings: async (context) => {
            query(context.request, [])
            return checkedResponse(accountSettingsSchema, await store.settings(scope(context)))
        },
        accountAccent: async (context) => {
            query(context.request, [])
            const { accent } = accentInput.parse(await jsonBody(context.request, 1024, context.signal))
            await store.accent(scope(context), accent)
            return { saved: true }
        },
        accountClaim: async (context) => {
            query(context.request, [])
            noBody(context.request)
            return checkedResponse(claimResponse, { message: await store.claim(scope(context)) })
        },
        accountToken: async (context) => {
            query(context.request, [])
            noBody(context.request)
            return checkedResponse(tokenResponse, { token: await store.token(scope(context)) })
        },
        accountRevokeToken: async (context) => {
            query(context.request, [])
            noBody(context.request)
            await store.revoke(scope(context))
            return { saved: true }
        },
        accountAvatar: async (context) => {
            query(context.request, [])
            const input = avatarInputSchema.parse(await jsonBody(context.request, 1_400_000, context.signal))
            const bytes = Buffer.from(input.data, 'base64')
            if (!bytes.length || bytes.length > MAX_AVATAR_SIZE || bytes[0] !== 0xff || bytes[1] !== 0xd8)
                throw new MobileError('invalid_input')
            return checkedResponse(urlResponse, { url: await store.avatar(scope(context), bytes, input.contentType) })
        },
        accountCheckout: async (context) => {
            query(context.request, [])
            const { plan } = checkoutInput.parse(await jsonBody(context.request, 1024, context.signal))
            return checkedResponse(urlResponse, { url: await store.checkout(scope(context), plan) })
        },
        accountBilling: async (context) => {
            query(context.request, [])
            noBody(context.request)
            return checkedResponse(urlResponse, { url: await store.billing(scope(context)) })
        },
    } satisfies Record<string, MobileOperation>
}
