'use server'

import { z } from 'zod'
import { createMemory, deleteMemory, getPersonalMemories, getFederatedMemories } from '@/server/db/memories'
import { getUserOrThrow } from '@/server/auth/user'

const createMemorySchema = z.object({
    content: z.string().min(1, 'Content is required.'),
    isPublic: z.boolean(),
    isStreak: z.boolean(),
})

export async function createMemoryAction(input: z.infer<typeof createMemorySchema>) {
    const { userId } = await getUserOrThrow()

    const validatedInput = createMemorySchema.parse(input)

    await createMemory({
        ...validatedInput,
        creator: userId,
    })
}

const getMemoriesSchema = z.object({
    page: z.number(),
    size: z.number(),
})

export async function getPersonalMemoriesAction(input: z.infer<typeof getMemoriesSchema>) {
    const { userId } = await getUserOrThrow()
    const { page, size } = getMemoriesSchema.parse(input)
    return getPersonalMemories({ userId, page, size })
}

export async function getFederatedMemoriesAction(input: z.infer<typeof getMemoriesSchema>) {
    const { page, size } = getMemoriesSchema.parse(input)
    return getFederatedMemories({ page, size })
}

const deleteMemorySchema = z.object({
    id: z.number(),
})

export async function deleteMemoryAction(input: z.infer<typeof deleteMemorySchema>) {
    const { userId } = await getUserOrThrow()

    const validatedInput = deleteMemorySchema.parse(input)

    await deleteMemory({
        ...validatedInput,
        creator: userId,
    })
}