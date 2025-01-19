'use server'

import { authReadToLib } from '@/server/auth/role'
import { loadWords, drawWords } from '@/server/db/word'

export default async function load(lib: string, cursor?: string) {
    await authReadToLib(lib)
    return await loadWords({ lib, cursor })
}

export async function draw(lib: string, start: Date, end: Date) {
    return await drawWords({ lib, start, end, size: 5 })
}
