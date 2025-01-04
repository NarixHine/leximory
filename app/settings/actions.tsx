'use server'

import { auth } from '@clerk/nextjs/server'

export default async function getToken() {
	const { getToken } = await auth()
	const token = await getToken({ template: 'shortcut' })
	return token!
}
