import 'server-only'
import { supabase } from '@repo/supabase'
import { cacheTag } from 'next/cache'
import { momentSH } from '@/lib/moment'
import { ensureUserExists } from '@repo/supabase/user'

// Function to get the LexiCoin balance for a user
// Or to ensure the user exists and create them with a default balance if they don't
export async function getLexicoinBalance(uid: string) {
    'use cache'
    cacheTag('lexicoin')

    await ensureUserExists(uid)
    const { data: { lexicoin } } = await supabase
        .from('users')
        .select('lexicoin')
        .eq('id', uid)
        .single()
        .throwOnError()

    return lexicoin
}

export async function addLexicoinBalance(uid: string, amount: number) {
    const balance = await getLexicoinBalance(uid)
    await supabase
        .from('users')
        .update({ lexicoin: balance + amount })
        .eq('id', uid)
        .throwOnError()
    return { success: true, message: `余额增加 ${amount} LexiCoin` }
}

export async function setLastClaimDate(uid: string) {
    await supabase
        .from('users')
        .update({ last_daily_claim: momentSH().toISOString() })
        .eq('id', uid)
        .throwOnError()
}

export async function subtractLexicoinBalance(uid: string, amount: number) {
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
