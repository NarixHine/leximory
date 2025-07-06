'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/server/client/supabase/server'
import { z } from 'zod'
import { getAuthErrorMessage } from './error-messages'

const authSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1)
})

export async function login(props: z.infer<typeof authSchema>) {
    const supabase = await createClient()

    const parseResult = authSchema.safeParse(props)

    if (!parseResult.success) {
        return { error: '输入格式错误' }
    }

    const { data } = parseResult

    const { error } = await supabase.auth.signInWithPassword(data)

    if (error) {
        return { error: getAuthErrorMessage(error) }
    }

    revalidatePath('/', 'layout')
    redirect('/library')
}

export async function signup(props: z.infer<typeof authSchema>) {
    const supabase = await createClient()

    const parseResult = authSchema.safeParse(props)

    if (!parseResult.success) {
        return { error: '输入格式错误' }
    }

    const { data } = parseResult

    const { error } = await supabase.auth.signUp(data)

    if (error) {
        return { error: getAuthErrorMessage(error) }
    }

    revalidatePath('/', 'layout')
    redirect('/library')
}
