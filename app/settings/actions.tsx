'use server'

import { getAuthOrThrow } from '@/lib/auth'
import { auth } from '@clerk/nextjs/server'
import { getAccentPreference, setAccentPreference } from '@/server/db/preference'

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
