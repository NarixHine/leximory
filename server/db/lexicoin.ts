import 'server-only'
import { getXataClient } from '../client/xata'
import { unstable_cacheTag as cacheTag, revalidateTag } from 'next/cache'
import moment from 'moment-timezone'

const xata = getXataClient()

export async function getLexicoinBalance(uid: string) {
    'use cache'
    cacheTag('lexicoin')
    let balance = await xata.db.users.select(['lexicoin']).filter({ id: uid }).getFirst()
    if (!balance) {
        balance = await xata.db.users.create({ id: uid, lexicoin: 20 }).catch(() => {
            return xata.db.users.select(['lexicoin']).filter({ id: uid }).getFirstOrThrow()
        })
    }
    return balance.lexicoin
}

export async function addLexicoinBalance(uid: string, amount: number) {
    revalidateTag('lexicoin')
    const balance = await getLexicoinBalance(uid)
    await xata.db.users.update({ id: uid, lexicoin: balance + amount })
    return { success: true, message: `余额增加 ${amount} LexiCoin` }
}

export async function setLastClaimDate(uid: string) {
    revalidateTag('lexicoin')
    await xata.db.users.update({ id: uid, last_daily_claim: moment.tz('Asia/Shanghai').toDate() })
}

export async function subtractLexicoinBalance(uid: string, amount: number) {
    revalidateTag('lexicoin')
    const balance = await getLexicoinBalance(uid)
    if (balance < amount) {
        return { success: false, message: `余额不足，你还有 ${balance} LexiCoin` }
    }
    await xata.db.users.update({ id: uid, lexicoin: balance - amount })
    return { success: true }
}

export async function getLibPrice(lib: string) {
    const { price } = await xata.db.libraries.select(['price']).filter({ id: lib }).getFirstOrThrow()
    return price
}

export async function getLastDailyClaim(uid: string) {
    'use cache'
    cacheTag('lexicoin')
    const user = await xata.db.users.select(['last_daily_claim']).filter({ id: uid }).getFirst()
    if (!user) {
        return null
    }
    return user.last_daily_claim
}
