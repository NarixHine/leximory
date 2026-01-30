import { supabase } from '..'

export async function ensureUserExists(uid: string) {
    await supabase
        .from('users')
        .upsert(
            { id: uid, lexicoin: 20 },
            {
                onConflict: 'id', // Conflict resolution on the 'id' column.
                ignoreDuplicates: true // If conflict, return existing row without updating.
            }
        )
        .throwOnError()
}
