'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/server/client/supabase/server'
import { z } from 'zod'

const authSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1)
})

export async function login(props: z.infer<typeof authSchema>) {
    const supabase = await createClient()

    const parseResult = authSchema.safeParse(props)

    if (!parseResult.success) {
        throw parseResult.error
    }

    const { data } = parseResult

    const { error } = await supabase.auth.signInWithPassword(data)

    if (error) {
        throw error
    }

    revalidatePath('/', 'layout')
    redirect('/library')
}

export async function signup(props: z.infer<typeof authSchema>) {
    const supabase = await createClient()

    const parseResult = authSchema.safeParse(props)

    if (!parseResult.success) {
        throw parseResult.error
    }

    const { data } = parseResult

    const { error } = await supabase.auth.signUp(data)

    if (error) {
        throw error
    }

    revalidatePath('/', 'layout')
    redirect('/library')
}
