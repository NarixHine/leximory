import 'server-only'
import { z } from 'zod'
import { accountSettingsSchema } from '@repo/api'
import { supabase } from '@repo/supabase'
import { redis } from '@repo/kv/redis'
import {
    PLANS,
    PLAN_LABELS,
    PLAN_COMMENTARY_QUOTA,
    PLAN_AUDIO_QUOTA,
    PLAN_DAILY_LEXICOIN,
    CREEM_PRODUCT_ID,
    prefixUrl,
} from '@repo/env/config'
import { revalidateTag } from 'next/cache'
import { momentSH } from '@/lib/moment'
import { listLibs } from '@/server/db/lib'
import { aggrWordHistogram } from '@/server/db/word'
import { getOrCreateToken, revokeToken } from '@/server/db/token'
import { createRequest } from '@/server/db/creem'
import { creem } from '@/server/client/creem'
import { MobileError } from './errors'
import { checkedResponse } from './http'
import type { AccountScope, AccountStore } from './account'

const profileMetadata = z.object({ username: z.string().nullish(), avatar_url: z.string().nullish() })

async function loadAccount({ subject, signal }: AccountScope) {
    const { data: user } = await supabase
        .from('users')
        .select('plan,lexicoin,last_daily_claim,accent,creem_id')
        .eq('id', subject.userId)
        .abortSignal(signal)
        .single()
        .throwOnError()
    const plan = checkedResponse(z.enum(PLANS), user.plan ?? 'beginner')
    const today = momentSH().format('YYYY-MM-DD')
    const hasClaimed = !!user.last_daily_claim && momentSH(user.last_daily_claim).format('YYYY-MM-DD') === today
    return { user, plan, today, hasClaimed }
}

async function allowance(userId: string, type: 'commentary' | 'audio', limit: number) {
    const key = `user:${userId}:${type}_quota`
    const [used, resetsIn] = await Promise.all([redis.get<number>(key), redis.ttl(key)])
    return { used: used ?? 0, limit, resetsIn }
}

export const accountStore: AccountStore = {
    async settings(context) {
        const { user, plan, today, hasClaimed } = await loadAccount(context)
        const { userId } = context.subject
        const [profile, definitions, audio, libs] = await Promise.all([
            supabase.auth.admin.getUserById(userId),
            allowance(userId, 'commentary', PLAN_COMMENTARY_QUOTA[plan]),
            allowance(userId, 'audio', PLAN_AUDIO_QUOTA[plan]),
            listLibs({ owner: userId }),
        ])
        if (profile.error || !profile.data.user) throw new MobileError('service_unavailable')
        const metadata = checkedResponse(profileMetadata, profile.data.user.user_metadata)
        const activity = await aggrWordHistogram({ libs, size: 30 })
        return {
            userId,
            plan,
            definitions,
            audio,
            username: metadata.username ?? null,
            image: metadata.avatar_url ?? null,
            email: profile.data.user.email ?? null,
            createdAt: profile.data.user.created_at,
            planLabel: PLAN_LABELS[plan],
            balance: user.lexicoin,
            dailyAmount: PLAN_DAILY_LEXICOIN[plan],
            hasClaimed,
            accent: checkedResponse(accountSettingsSchema.shape.accent, user.accent),
            activity,
            today,
            subscriptionPlans: (['beginner', 'bilingual', 'polyglot'] satisfies (typeof plan)[]).map((id) => ({
                id,
                name: PLAN_LABELS[id],
                price: { beginner: 'US$0.00', bilingual: 'US$4.49', polyglot: 'US$6.00' }[id],
                definitions: PLAN_COMMENTARY_QUOTA[id],
                audio: PLAN_AUDIO_QUOTA[id],
                dailyAmount: PLAN_DAILY_LEXICOIN[id],
            })),
        }
    },
    async accent({ subject, signal }, accent) {
        await supabase.from('users').update({ accent }).eq('id', subject.userId).abortSignal(signal).throwOnError()
        revalidateTag('accent', { expire: 0 })
    },
    async claim(context) {
        const { user, plan, hasClaimed } = await loadAccount(context)
        if (hasClaimed) return '今日已领取'
        let update = supabase
            .from('users')
            .update({
                lexicoin: user.lexicoin + PLAN_DAILY_LEXICOIN[plan],
                last_daily_claim: momentSH().toISOString(),
            })
            .eq('id', context.subject.userId)
            .eq('lexicoin', user.lexicoin)
        update = user.last_daily_claim
            ? update.eq('last_daily_claim', user.last_daily_claim)
            : update.is('last_daily_claim', null)
        const { data } = await update.select('id').abortSignal(context.signal).throwOnError()
        if (!data.length) throw new MobileError('stale_revision')
        revalidateTag('lexicoin', { expire: 0 })
        return `领取成功，LexiCoin + ${PLAN_DAILY_LEXICOIN[plan]}`
    },
    async token({ subject }) {
        return getOrCreateToken(subject.userId)
    },
    async revoke({ subject }) {
        await revokeToken(subject.userId)
    },
    async avatar({ subject }, bytes, contentType) {
        const { error } = await supabase.storage
            .from('avatars')
            .upload(subject.userId, bytes, { upsert: true, contentType })
        if (error) throw error
        return supabase.storage.from('avatars').getPublicUrl(subject.userId).data.publicUrl
    },
    async checkout({ subject }, plan) {
        const checkout = await creem.createCheckoutSession({
            success_url: prefixUrl('/settings'),
            product_id: CREEM_PRODUCT_ID[plan],
            request_id: await createRequest(subject.userId),
        })
        return checkout.checkout_url
    },
    async billing(context) {
        const { user } = await loadAccount(context)
        if (!user.creem_id) throw new MobileError('inaccessible')
        const portal = await creem.createBillingPortalSession({ customer_id: user.creem_id })
        return portal.customer_portal_link
    },
}
