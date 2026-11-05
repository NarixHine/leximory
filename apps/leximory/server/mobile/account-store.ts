import 'server-only'
import { getMembership } from '@repo/user/membership'
import { APPLE_PRODUCTS } from '@repo/env/billing'
import { applePurchasesEnabled } from '@/server/billing/apple'
import { z } from 'zod'
import { accountSettingsSchema } from '@repo/api'
import { supabase } from '@repo/supabase'
import { redis } from '@repo/kv/redis'
import {
    PLAN_LABELS,
    PLAN_COMMENTARY_QUOTA,
    PLAN_AUDIO_QUOTA,
    PLAN_DAILY_LEXICOIN,
    CREEM_PRODUCT_ID,
    prefixUrl,
} from '@repo/env/config'
import { invalidateMutationCaches } from './mutation-effects'
import { momentSH } from '@/lib/moment'
import { listLibs } from '@/server/db/lib'
import { aggrWordHistogram } from '@/server/db/word'
import { getOrCreateToken, revokeToken } from '@/server/db/token'
import { createRequest } from '@/server/db/creem'
import { creem } from '@/server/client/creem'
import { MobileError } from './errors'
import { checkedResponse } from './http'
import { readAccountAllowance } from './account-allowance'
import type { AccountScope, AccountStore } from './account'

const profileMetadata = z.object({ username: z.string().nullish(), avatar_url: z.string().nullish() })

async function loadAccount({ subject, signal }: AccountScope) {
    const { data: user } = await supabase
        .from('users')
        .select('lexicoin,last_daily_claim,accent,creem_id')
        .eq('id', subject.userId)
        .abortSignal(signal)
        .single()
        .throwOnError()
    const membership = await getMembership(subject.userId, signal)
    const plan = membership.plan
    const today = momentSH().format('YYYY-MM-DD')
    const hasClaimed = !!user.last_daily_claim && momentSH(user.last_daily_claim).format('YYYY-MM-DD') === today
    return { user, plan, today, hasClaimed, membership }
}

export const accountStore: AccountStore = {
    async settings(context) {
        const { user, plan, today, hasClaimed, membership } = await loadAccount(context)
        const { userId } = context.subject
        const [profile, definitions, audio, libs] = await Promise.all([
            supabase.auth.admin.getUserById(userId),
            readAccountAllowance({ store: redis, userId, type: 'commentary', limit: PLAN_COMMENTARY_QUOTA[plan] }),
            readAccountAllowance({ store: redis, userId, type: 'audio', limit: PLAN_AUDIO_QUOTA[plan] }),
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
            membership:
                membership.legacyPlan !== 'beginner'
                    ? {
                          provider: 'legacy',
                          plan: membership.legacyPlan,
                          status: 'active',
                          expiresAt: null,
                          autoRenews: null,
                      }
                    : membership.memberships[0]
                      ? {
                            provider: 'appStore',
                            plan: membership.memberships[0].plan,
                            status: membership.memberships[0].status,
                            expiresAt: membership.memberships[0].expiresAt,
                            autoRenews: membership.memberships[0].autoRenews,
                        }
                      : null,
            memberships: [
                ...(membership.legacyPlan !== 'beginner'
                    ? [
                          {
                              provider: 'legacy' as const,
                              plan: membership.legacyPlan,
                              status: 'active' as const,
                              expiresAt: null,
                              autoRenews: null,
                          },
                      ]
                    : []),
                ...membership.memberships,
            ],
            appleBilling: {
                enabled: applePurchasesEnabled(),
                purchaseEligible: membership.purchaseEligible,
                products: Object.entries(APPLE_PRODUCTS).map(([plan, productId]) => ({
                    plan: checkedResponse(z.enum(['bilingual', 'polyglot']), plan),
                    productId,
                })),
            },
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
        invalidateMutationCaches('accent')
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
        invalidateMutationCaches('lexicoin')
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
        if (!(await getMembership(subject.userId)).purchaseEligible) throw new MobileError('inaccessible')
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
