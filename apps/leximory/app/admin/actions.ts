'use server'

import { z } from '@repo/schema'
import { supabase } from '@repo/supabase'
import { ensureUserExists } from '@repo/supabase/user'
import { getUserOrThrow, updatePlan } from '@repo/user'
import { ADMIN_UID, PLANS, Plan } from '@repo/env/config'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/server/auth/role'

const emailSchema = z.string().trim().toLowerCase().pipe(z.email())
const planSchema = z.enum(PLANS)
const userIdSchema = z.uuid()

function revalidateAdmin() {
    revalidatePath('/admin')
    revalidatePath('/admin/users')
}

export async function changeUserEmail(userId: string, newEmail: string) {
    await requireAdmin()

    const parsedUserId = userIdSchema.parse(userId)
    const parsedEmail = emailSchema.parse(newEmail)

    const { error } = await supabase.auth.admin.updateUserById(parsedUserId, {
        email: parsedEmail,
        email_confirm: true,
    })

    if (error) {
        throw new Error(`Failed to update email: ${error.message}`)
    }

    revalidateAdmin()
    return { success: true }
}

export async function changeUserPlan(userId: string, newPlan: Plan) {
    await requireAdmin()

    const parsedUserId = userIdSchema.parse(userId)
    const parsedPlan = planSchema.parse(newPlan)

    await ensureUserExists(parsedUserId)
    await updatePlan(parsedUserId, parsedPlan)

    revalidateAdmin()
    return { success: true }
}

export async function deleteUser(userId: string) {
    await requireAdmin()

    const parsedUserId = userIdSchema.parse(userId)
    const { userId: currentUserId } = await getUserOrThrow()

    if (parsedUserId === currentUserId || parsedUserId === ADMIN_UID) {
        throw new Error('You cannot delete the administrator account')
    }

    const { error } = await supabase.auth.admin.deleteUser(parsedUserId)

    if (error) {
        throw new Error(`Failed to delete user: ${error.message}`)
    }

    revalidateAdmin()
    return { success: true }
}
