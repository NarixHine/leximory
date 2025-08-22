'use server'

import { getPlan, getUserOrThrow } from '@/server/auth/user'
import { getAccentPreference, setAccentPreference } from '@/server/db/preference'
import { addLexicoinBalance, getLastDailyClaim, setLastClaimDate } from '@/server/db/lexicoin'
import { momentSH } from '@/lib/moment'
import { revalidatePath } from 'next/cache'
import { PLAN_DAILY_LEXICOIN } from '@/lib/config'
import { creem } from '@/server/client/creem'
import { redirect } from 'next/navigation'
import { getCustomerId } from '@/server/db/creem'
import { supabase } from '@/server/client/supabase'
import { getOrCreateToken, revokeToken } from '@/server/db/token'

export async function getUserToken() {
	const { userId } = await getUserOrThrow()
	return await getOrCreateToken(userId)
}

export async function revokeUserToken() {
	const { userId } = await getUserOrThrow()
	return await revokeToken(userId)
}

export async function setPreference(isBrE: boolean) {
	const { userId } = await getUserOrThrow()
	await setAccentPreference({ accent: isBrE ? 'BrE' : 'AmE', userId })
}

export async function getPreference() {
	const { userId } = await getUserOrThrow()
	const accent = await getAccentPreference({ userId })
	return accent
}

export async function getDailyLexicoin() {
	const { userId } = await getUserOrThrow()
	const plan = await getPlan(userId)
	const lastDailyClaim = await getLastDailyClaim(userId)
	if (lastDailyClaim && momentSH(lastDailyClaim).isSame(momentSH(), 'day')) {
		throw new Error('今天已领取 LexiCoin')
	}
	await addLexicoinBalance(userId, PLAN_DAILY_LEXICOIN[plan])
	await setLastClaimDate(userId)
	revalidatePath('/settings')
	return { message: `领取成功，LexiCoin + ${PLAN_DAILY_LEXICOIN[plan]}` }
}

export async function manageSubscription() {
	const { userId } = await getUserOrThrow()
	const customerId = await getCustomerId(userId)
	if (!customerId) {
		throw new Error('Customer ID not found')
	}
	const session = await creem.createBillingPortalSession({
		customer_id: customerId,
	})
	redirect(session.customer_portal_link)
}

export async function uploadAvatar(file: File) {
	if (!file) throw new Error('No file provided')
	const user = await getUserOrThrow()
	const { error } = await supabase.storage.from('avatars').upload(user.userId, file, {
		upsert: true,
		contentType: file.type
	})
	if (error) throw new Error(error.message)
	const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(user.userId)
	return publicUrl
}
