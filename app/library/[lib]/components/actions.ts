'use server'

import { getAuthOrThrow } from '@/lib/auth'
import { starLib } from '@/server/db/lib'

export const star = async (lib: string) => {
    const { userId } = await getAuthOrThrow()
    await starLib({ lib, userId })
}
