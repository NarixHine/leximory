'use server'

import { getPlan, getUserOrThrow } from '@/server/auth/user'
import { getAccentPreference, setAccentPreference } from '@/server/db/preference'
import { addLexicoinBalance, getLastDailyClaim, setLastClaimDate } from '@/server/db/lexicoin'
import moment from 'moment-timezone'
import { revalidatePath } from 'next/cache'
import { dailyLexicoinClaimMap } from '@/lib/config'
import { creem } from '@/server/client/creem'
import { redirect } from 'next/navigation'
import { getCustomerId } from '@/server/db/creem'

export default async function getToken() {
	// TODO: implement this
	return 'null'
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
	if (lastDailyClaim && moment.tz(lastDailyClaim, 'Asia/Shanghai').isSame(moment.tz('Asia/Shanghai'), 'day')) {
		throw new Error('今天已领取 LexiCoin')
	}
	await addLexicoinBalance(userId, dailyLexicoinClaimMap[plan])
	await setLastClaimDate(userId)
	revalidatePath('/settings')
	return { message: `领取成功，LexiCoin + ${dailyLexicoinClaimMap[plan]}` }
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
