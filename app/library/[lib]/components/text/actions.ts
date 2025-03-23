'use server'

import { authWriteToLib } from '@/server/auth/role'
import { createText } from '@/server/db/text'

export async function add(lib: string) {
    await authWriteToLib(lib)
    const id = await createText({ lib })
    return id
}
