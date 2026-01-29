import { CookieOptions, createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import env from '@repo/env'
import { cookiesFactory } from './utils'

export async function createClient() {
    const cookieStore = await cookies()

    return createServerClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value, ...options })
                    } catch {
                        // This can be ignored if middleware is handling session refreshes
                    }
                },
                remove(name: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value: '', ...options })
                    } catch {
                        // This can be ignored
                    }
                },
            },
            cookieOptions: cookiesFactory(),
        }
    )
}