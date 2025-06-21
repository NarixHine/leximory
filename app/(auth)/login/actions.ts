'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/server/client/supabase/server'
import { z } from 'zod'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const loginSchema = z.object({
      email: z.string().email(),
      password: z.string().min(1)
  })

  const parseResult = loginSchema.safeParse(formData)

  if (!parseResult.success) {
      redirect('/error')
  }

  const data = parseResult.data

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    redirect('/error')
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signUp(data)

  if (error) {
    redirect('/error')
  }

  revalidatePath('/', 'layout')
  redirect('/')
}