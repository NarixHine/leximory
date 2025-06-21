import 'server-only'
import { getLexicoinBalance } from './lexicoin'
import { nanoid } from 'nanoid'
import { supabase } from '../client/supabase'

// Get or create a token for the current user
export async function getOrCreateToken(userId: string) {
    // Ensure Lexicoin balance record is initialized
    await getLexicoinBalance(userId)
    // Check if token exists
    const { data: { token } } = await supabase.from('users').select('token').eq('id', userId).single().throwOnError()
    if (token) {
        return token
    }
    const newToken = nanoid(32)
    await supabase.from('users').update({ token: newToken }).eq('id', userId)
    return newToken
}

// Verify a token and return the associated user id
export async function verifyToken(token: string) {
    const { data: { id } } = await supabase.from('users').select('id').eq('token', token).single().throwOnError()
    return id
}

export async function revokeToken(userId: string) {
    await supabase.from('users').update({ token: null }).eq('id', userId)
}
