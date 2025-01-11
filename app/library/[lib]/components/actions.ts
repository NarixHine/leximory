'use server'

import { getAuthOrThrow } from '@/lib/auth'
import { starLib } from '@/server/db/lib'
import { revalidatePath } from 'next/cache'

export const star = async (lib: string) => {
    const { userId } = await getAuthOrThrow()
    await starLib({ lib, userId })
    revalidatePath(`/library/${lib}`)
}
