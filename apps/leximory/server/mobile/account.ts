import 'server-only'
import { z } from 'zod'
import { accountSettingsSchema, avatarInputSchema } from '@repo/api'
import { supabase } from '@repo/supabase'
import { redis } from '@repo/kv/redis'
import { PLANS, PLAN_LABELS, PLAN_COMMENTARY_QUOTA, PLAN_AUDIO_QUOTA, PLAN_DAILY_LEXICOIN, MAX_AVATAR_SIZE, CREEM_PRODUCT_ID, prefixUrl } from '@repo/env/config'
import { revalidateTag } from 'next/cache'
import { momentSH } from '@/lib/moment'
import { listLibs } from '@/server/db/lib'
import { aggrWordHistogram } from '@/server/db/word'
import { getOrCreateToken, revokeToken } from '@/server/db/token'
import { createRequest } from '@/server/db/creem'
import { creem } from '@/server/client/creem'
import { requireMobileSubject, type BearerVerifier } from './auth'
import { MobileError, mobileErrorResponse } from './errors'

export function createAccountHandler(verify: BearerVerifier) {
    return async (request: Request): Promise<Response> => {
        try {
            const { userId } = await requireMobileSubject(request, verify)
            const signal = AbortSignal.any([request.signal, AbortSignal.timeout(20000)])
            const url = new URL(request.url)
            if (url.searchParams.size || Number(request.headers.get('content-length') ?? 0) > 1_400_000) throw new MobileError('invalid_input')
            const path = url.pathname.slice('/api/mobile/v1/account'.length)
            const { data: user } = await supabase.from('users').select('plan,lexicoin,last_daily_claim,accent,creem_id').eq('id', userId).abortSignal(signal).single().throwOnError()
            const plan = z.enum(PLANS).parse(user.plan ?? 'beginner')
            const today = momentSH().format('YYYY-MM-DD')
            const hasClaimed = !!user.last_daily_claim && momentSH(user.last_daily_claim).format('YYYY-MM-DD') === today
            let result: unknown
            if (request.method === 'GET' && path === '') {
                const allowance = async (type: 'commentary' | 'audio', limit: number) => {
                    const key = `user:${userId}:${type}_quota`
                    const [used, resetsIn] = await Promise.all([redis.get<number>(key), redis.ttl(key)])
                    return { used: used ?? 0, limit, resetsIn }
                }
                const [profile, definitions, audio, libs] = await Promise.all([
                    supabase.auth.admin.getUserById(userId), allowance('commentary', PLAN_COMMENTARY_QUOTA[plan]),
                    allowance('audio', PLAN_AUDIO_QUOTA[plan]), listLibs({ owner: userId }),
                ])
                if (profile.error || !profile.data.user) throw new MobileError('service_unavailable')
                const metadata = z.object({ username: z.string().nullish(), avatar_url: z.string().nullish() }).passthrough().parse(profile.data.user.user_metadata)
                const activity = await aggrWordHistogram({ libs, size: 30 })
                result = accountSettingsSchema.parse({
                    userId, plan, definitions, audio, username: metadata.username ?? null, image: metadata.avatar_url ?? null,
                    email: profile.data.user.email ?? null, createdAt: profile.data.user.created_at,
                    planLabel: PLAN_LABELS[plan], balance: user.lexicoin, dailyAmount: PLAN_DAILY_LEXICOIN[plan], hasClaimed,
                    accent: user.accent, activity, today,
                    subscriptionPlans: (['beginner', 'bilingual', 'polyglot'] satisfies (typeof plan)[]).map(id => ({
                        id, name: PLAN_LABELS[id], price: { beginner: 'US$0.00', bilingual: 'US$4.49', polyglot: 'US$6.00' }[id],
                        definitions: PLAN_COMMENTARY_QUOTA[id], audio: PLAN_AUDIO_QUOTA[id], dailyAmount: PLAN_DAILY_LEXICOIN[id],
                    })),
                })
            } else if (request.method === 'POST') {
                switch (path) {
                    case '/accent': {
                        const { accent } = z.object({ accent: z.enum(['BrE', 'AmE']) }).strict().parse(await request.json())
                        await supabase.from('users').update({ accent }).eq('id', userId).throwOnError()
                        revalidateTag('accent', { expire: 0 }); result = { saved: true }; break
                    }
                    case '/claim': {
                        if (hasClaimed) { result = { message: '今日已领取' }; break }
                        let update = supabase.from('users').update({ lexicoin: user.lexicoin + PLAN_DAILY_LEXICOIN[plan], last_daily_claim: momentSH().toISOString() }).eq('id', userId).eq('lexicoin', user.lexicoin)
                        update = user.last_daily_claim ? update.eq('last_daily_claim', user.last_daily_claim) : update.is('last_daily_claim', null)
                        const { data } = await update.select('id').throwOnError()
                        if (!data.length) throw new MobileError('stale_revision')
                        revalidateTag('lexicoin', { expire: 0 }); result = { message: `领取成功，LexiCoin + ${PLAN_DAILY_LEXICOIN[plan]}` }; break
                    }
                    case '/token': result = { token: await getOrCreateToken(userId) }; break
                    case '/revoke-token': await revokeToken(userId); result = { saved: true }; break
                    case '/avatar': {
                        const input = avatarInputSchema.parse(await request.json())
                        const bytes = Buffer.from(input.data, 'base64')
                        if (!bytes.length || bytes.length > MAX_AVATAR_SIZE || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new MobileError('invalid_input')
                        const { error } = await supabase.storage.from('avatars').upload(userId, bytes, { upsert: true, contentType: input.contentType })
                        if (error) throw error
                        result = { url: supabase.storage.from('avatars').getPublicUrl(userId).data.publicUrl }; break
                    }
                    case '/checkout': {
                        const { plan: selected } = z.object({ plan: z.enum(['bilingual', 'polyglot']) }).strict().parse(await request.json())
                        const checkout = await creem.createCheckoutSession({ success_url: prefixUrl('/settings'), product_id: CREEM_PRODUCT_ID[selected], request_id: await createRequest(userId) })
                        result = { url: checkout.checkout_url }; break
                    }
                    case '/billing': {
                        if (!user.creem_id) throw new MobileError('inaccessible')
                        const portal = await creem.createBillingPortalSession({ customer_id: user.creem_id })
                        result = { url: portal.customer_portal_link }; break
                    }
                    default: throw new MobileError('inaccessible')
                }
            } else { throw new MobileError('inaccessible') }
            signal.throwIfAborted()
            return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
        } catch (error) { return mobileErrorResponse(error instanceof z.ZodError ? new MobileError('invalid_input') : error) }
    }
}
