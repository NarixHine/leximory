import 'server-only'
import { supabase } from '../client/supabase'
import { unstable_cacheTag as cacheTag, revalidateTag } from 'next/cache'
import moment from 'moment-timezone'

export async function getLexicoinBalance(uid: string) {
    'use cache'
    cacheTag('lexicoin')
    const { data, error } = await supabase
        .from('users')
        .select('lexicoin')
        .eq('id', uid)
        .single()

    if (error || !data) {
        const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert({ id: uid, lexicoin: 20 })
            .select('lexicoin')
            .single()

        if (createError) {
            const { data: existingUser } = await supabase
                .from('users')
                .select('lexicoin')
                .eq('id', uid)
                .single()
            return existingUser?.lexicoin ?? 0
        }
        return newUser.lexicoin
    }
    return data.lexicoin
}

export async function addLexicoinBalance(uid: string, amount: number) {
    revalidateTag('lexicoin')
    const balance = await getLexicoinBalance(uid)
    await supabase
        .from('users')
        .update({ lexicoin: balance + amount })
        .eq('id', uid)
        .throwOnError()
    return { success: true, message: `余额增加 ${amount} LexiCoin` }
}

export async function setLastClaimDate(uid: string) {
    revalidateTag('lexicoin')
    await supabase
        .from('users')
        .update({ last_daily_claim: moment.tz('Asia/Shanghai').toISOString() })
        .eq('id', uid)
        .throwOnError()
}

export async function subtractLexicoinBalance(uid: string, amount: number) {
    revalidateTag('lexicoin')
    const balance = await getLexicoinBalance(uid)
    if (balance < amount) {
        return { success: false, message: `余额不足，你还有 ${balance} LexiCoin` }
    }
    await supabase
        .from('users')
        .update({ lexicoin: balance - amount })
        .eq('id', uid)
        .throwOnError()
    return { success: true }
}

export async function getLibPrice(lib: string) {
    const { data } = await supabase
        .from('libraries')
        .select('price')
        .eq('id', lib)
        .single()
        .throwOnError()
    return data.price
}

export async function getLastDailyClaim(uid: string) {
    'use cache'
    cacheTag('lexicoin')
    const { data } = await supabase
        .from('users')
        .select('last_daily_claim')
        .eq('id', uid)
        .single()

    return data?.last_daily_claim
}
