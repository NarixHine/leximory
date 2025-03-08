'use server'

import { getAuthOrThrow } from '@/server/auth/role'
import { auth } from '@clerk/nextjs/server'
import { getAccentPreference, setAccentPreference } from '@/server/db/preference'
import { addLexicoinBalance, getLastDailyClaim, setLastClaimDate } from '@/server/db/lexicoin'
import moment from 'moment'
import { revalidatePath } from 'next/cache'
import { dailyLexicoinClaimMap } from '@/lib/config'
import { getPlan } from '@/server/auth/quota'

export default async function getToken() {
	const { getToken } = await auth()
	const token = await getToken({ template: 'shortcut' })
	return token!
}

export async function setPreference(isBrE: boolean) {
	const { userId } = await getAuthOrThrow()
	await setAccentPreference({ accent: isBrE ? 'BrE' : 'AmE', userId })
}

export async function getPreference() {
	const { userId } = await getAuthOrThrow()
	const accent = await getAccentPreference({ userId })
	return accent
}

export async function getDailyLexicoin() {
	const { userId } = await getAuthOrThrow()
	const plan = await getPlan(userId)
	const lastDailyClaim = await getLastDailyClaim(userId)
	if (lastDailyClaim && moment(lastDailyClaim).isAfter(moment().subtract(1, 'day'))) {
		throw new Error('今天已领取 LexiCoin')
	}
	const balance = await addLexicoinBalance(userId, dailyLexicoinClaimMap[plan])
	await setLastClaimDate(userId)
	revalidatePath('/settings')
	return balance
}
