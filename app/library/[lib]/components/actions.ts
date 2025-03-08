'use server'

import { getAuthOrThrow } from '@/server/auth/role'
import { getLib, starLib } from '@/server/db/lib'
import { subtractLexicoinBalance, getLibPrice, addLexicoinBalance } from '@/server/db/lexicoin'
import { after } from 'next/server'
import { logsnagServer } from '@/lib/logsnag'

export const star = async (lib: string) => {
    const { userId } = await getAuthOrThrow()
    const price = await getLibPrice(lib)
    const logsnag = logsnagServer()
    const { success, message } = await subtractLexicoinBalance(userId, price)
    if (!success) {
        return { success, message }
    }
    else {
        await starLib({ lib, userId })
        const { owner } = await getLib({ id: lib })
        await addLexicoinBalance(owner, price / 5)
        after(async () => {
            await logsnag.track({
                event: '购买文库',
                channel: 'resource-sharing',
                icon: '🛒',
                description: `用 ${price} LexiCoin 购买了 ${lib}`,
                user_id: userId,
                tags: { lib }
            })
        })
        return { success: true, message: 'success' }
    }
}
