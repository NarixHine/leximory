import 'server-only'
import { getXataClient } from '../client/xata'

const xata = getXataClient()

export async function getLexicoinBalance(uid: string) {
    let balance = await xata.db.users.select(['lexicoin']).filter({ id: uid }).getFirst()
    if (!balance) {
        balance = await xata.db.users.create({ id: uid }).catch(() => {
            return xata.db.users.select(['lexicoin']).filter({ id: uid }).getFirstOrThrow()
        })
    }
    return balance.lexicoin
}

export async function addLexicoinBalance(uid: string, amount: number) {
    const balance = await getLexicoinBalance(uid)
    await xata.db.users.update({ id: uid, lexicoin: balance + amount })
    return { success: true, message: `余额增加 ${amount} LexiCoin` }
}

export async function setLastClaimDate(uid: string) {
    await xata.db.users.update({ id: uid, last_daily_claim: new Date() })
}

export async function subtractLexicoinBalance(uid: string, amount: number) {
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
    const user = await xata.db.users.select(['last_daily_claim']).filter({ id: uid }).getFirst()
    if (!user) {
        return null
    }
    return user.last_daily_claim
}
