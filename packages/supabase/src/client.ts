import { createBrowserClient } from '@supabase/ssr'
import env from '@repo/env'
import { cookiesFactory } from './utils'

const authLocks = new Map<string, Promise<void>>()

async function acquireAuthLock<T>(name: string, acquire: () => Promise<T>): Promise<T> {
    const previous = authLocks.get(name) ?? Promise.resolve()
    let release!: () => void
    const current = new Promise<void>(resolve => {
        release = resolve
    })
    const queued = previous.then(() => current)
    authLocks.set(name, queued)
    await previous

    try {
        return await acquire()
    } finally {
        release()
        if (authLocks.get(name) === queued) authLocks.delete(name)
    }
}

export function createClient() {
    return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        cookieOptions: cookiesFactory(),
        auth: {
            lock: (name, _timeout, acquire) => acquireAuthLock(name, acquire),
        },
    })
}
