'use server'

import { cookies } from 'next/headers'

export const clearCookies = async () => {
    const cookieStore = await cookies()
    cookieStore.getAll().forEach((cookie) => {
        cookieStore.delete(cookie.name)
    })
    return true
}
