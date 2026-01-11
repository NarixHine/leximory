'use server'

import { supabase } from '@repo/supabase'
import { updatePlan } from '@repo/user'
import { Plan } from '@repo/env/config'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/server/auth/role'

export async function changeUserEmail(userId: string, newEmail: string) {
    await requireAdmin()

    const { error } = await supabase.auth.admin.updateUserById(userId, {
        email: newEmail
    })

    if (error) {
        throw new Error(`Failed to update email: ${error.message}`)
    }

    revalidatePath('/admin')
    return { success: true }
}

export async function changeUserPlan(userId: string, newPlan: Plan) {
    await requireAdmin()

    await updatePlan(userId, newPlan)

    revalidatePath('/admin')
    return { success: true }
}

export async function deleteUser(userId: string) {
    await requireAdmin()

    const { error } = await supabase.auth.admin.deleteUser(userId)

    if (error) {
        throw new Error(`Failed to delete user: ${error.message}`)
    }

    revalidatePath('/admin')
    return { success: true }
}
