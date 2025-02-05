'use server'

import { cookies } from 'next/headers'

export async function showFollowUsModal() {
    const cookieStore = await cookies()
    cookieStore.set('has-shown-follow-us-modal', 'true')
}
