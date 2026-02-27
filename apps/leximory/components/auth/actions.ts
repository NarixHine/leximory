'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@repo/supabase/server'
import { z } from '@repo/schema'
import { getAuthErrorMessage } from './error-messages'
import { isTrustedPathname } from '@/lib/url'

const authSchema = z.object({
    email: z.email(),
    password: z.string().min(1),
    next: z.string().optional().nullable(),
})

export async function login(props: z.infer<typeof authSchema>) {
    const supabase = await createClient()

    const parseResult = authSchema.safeParse(props)

    if (!parseResult.success) {
        return { error: '输入格式错误' }
    }

    const { data: { email, password, next } } = parseResult

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        return { error: getAuthErrorMessage(error) }
    }

    revalidatePath('/', 'layout')
    redirect(next && isTrustedPathname(next) ? next : '/library')
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
    redirect('/sign-up-success')
}
