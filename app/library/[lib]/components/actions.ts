'use server'

import { getAuthOrThrow } from '@/server/auth/role'
import { starLib } from '@/server/db/lib'

export const star = async (lib: string) => {
    const { userId } = await getAuthOrThrow()
    await starLib({ lib, userId })
}
