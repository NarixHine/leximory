import { supabase } from '..'

export async function isUserActive(uid: string): Promise<boolean> {
    const { data, error } = await supabase.auth.admin.getUserById(uid)
    if (error) {
        if (error.status === 404 || error.code === 'user_not_found') return false
        throw error
    }
    return !data.user.app_metadata.account_deletion
}

export async function assertUserActive(uid: string): Promise<void> {
    if (!(await isUserActive(uid))) throw new Error('Account is unavailable')
}

export async function ensureUserExists(uid: string, signal?: AbortSignal) {
    const existing = supabase.from('users').select('id').eq('id', uid)
    if (signal) existing.abortSignal(signal)
    const { data } = await existing.maybeSingle().throwOnError()
    if (data) return
    await assertUserActive(uid)
    const query = supabase.from('users').upsert(
        { id: uid, lexicoin: 20 },
        {
            onConflict: 'id', // Conflict resolution on the 'id' column.
            ignoreDuplicates: true, // If conflict, return existing row without updating.
        },
    )
    if (signal) query.abortSignal(signal)
    await query.throwOnError()
}
