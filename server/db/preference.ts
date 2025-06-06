import 'server-only'

import { unstable_cacheTag as cacheTag } from 'next/cache'
import { supabase } from '../client/supabase'
import { revalidateTag } from 'next/cache'

export type Accent = 'BrE' | 'AmE'

export async function setAccentPreference({ accent, userId }: { accent: Accent, userId: string }) {
    await supabase
        .from('users')
        .update({ accent })
        .eq('id', userId)
        .throwOnError()
    revalidateTag('accent')
}

export async function getAccentPreference({ userId }: { userId: string }) {
    'use cache'
    cacheTag('accent')
    const { data } = await supabase
        .from('users')
        .select('accent')
        .eq('id', userId)
        .single()

    if (!data) {
        const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert({ id: userId })
            .select('accent')
            .single()

        if (createError) {
            const { data: existingUser } = await supabase
                .from('users')
                .select('accent')
                .eq('id', userId)
                .single()
                .throwOnError()
            return existingUser.accent as Accent
        }
        return newUser.accent as Accent
    }
    return data.accent as Accent
}
