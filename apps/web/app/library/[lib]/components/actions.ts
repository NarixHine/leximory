'use server'

import { getLib, starLib } from '@/server/db/lib'
import { subtractLexicoinBalance, getLibPrice, addLexicoinBalance } from '@/server/db/lexicoin'
import { getUserOrThrow } from '@repo/user'

export const star = async (lib: string) => {
    const { userId } = await getUserOrThrow()
    const price = await getLibPrice(lib)
    const { success, message } = await subtractLexicoinBalance(userId, price)
    if (!success) {
        return { success, message }
    }
    else {
        await starLib({ lib, userId })
        const { owner } = await getLib({ id: lib })
        await addLexicoinBalance(owner, price / 5)
        return { success: true, message: 'success' }
    }
}
