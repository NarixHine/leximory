'use server'

import { requireAdmin } from '@/server/auth/role'
import { getTimesDataByDate, removeIssue, updateTimes } from '@/server/db/times'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'

// Zod schema for Times data validation
const timesUpdateSchema = z.object({
    cover: z.string().url('Invalid cover image URL').min(1, 'Cover image URL is required'),
    news: z.string().min(1, 'News content is required'),
    novel: z.string().min(1, 'Novel content is required'),
    audio: z.string().url('Invalid audio URL').optional().or(z.literal('')),
    quiz: z.string().optional().transform((val) => {
        if (!val || val.trim() === '') return null
        try {
            return JSON.parse(val)
        } catch {
            throw new Error('Quiz data must be valid JSON format')
        }
    }),
})

export async function getTimesForEdit(date: string) {
    await requireAdmin()

    try {
        const data = await getTimesDataByDate(date)
        return { success: true, data }
    } catch {
        return { success: false, error: 'Times issue not found' }
    }
}

export async function updateTimesIssue(date: string, formData: z.infer<typeof timesUpdateSchema>) {
    await requireAdmin()

    try {
        // Validate with Zod
        const validatedData = timesUpdateSchema.parse(formData)

        const updatedData = {
            ...validatedData,
            audio: validatedData.audio || null,
        }

        // Insert updated data
        await updateTimes(date, updatedData)

        revalidateTag('times')

        return { success: true, message: 'Times issue updated successfully' }
    } catch (error) {
        // Handle Zod validation errors
        if (error instanceof z.ZodError) {
            const { message } = error.errors[0]
            return { success: false, error: message }
        }

        return { success: false, error: 'Failed to update times issue' }
    }
}

export async function deleteTimesIssue(date: string) {
    await requireAdmin()

    try {
        await removeIssue(date)
        revalidateTag('times')

        return { success: true, message: 'Times issue deleted successfully' }
    } catch {
        return { success: false, error: 'Failed to delete times issue' }
    }
}
