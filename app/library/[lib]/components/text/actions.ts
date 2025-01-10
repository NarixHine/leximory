'use server'

import { authWriteToLib } from '@/lib/auth'
import { createText } from '@/server/text'

export async function add(lib: string) {
    await authWriteToLib(lib)
    const id = await createText({ lib })
    return id
}
