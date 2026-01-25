'use server'

import { z } from '@repo/schema'
import { createMemory, deleteMemory, getPersonalMemories, getFederatedMemories, getPublicMemories } from '@/server/db/memories'
import { getUserOrThrow } from '@repo/user'
import { updateTag } from 'next/cache'

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
    updateTag(`memories:${userId}`)
    updateTag('memories:federated')
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

const getPublicMemoriesSchema = z.object({
    userId: z.string(),
    page: z.number(),
    size: z.number(),
})

export async function getPublicMemoriesAction(input: z.infer<typeof getPublicMemoriesSchema>) {
    const { userId, page, size } = getPublicMemoriesSchema.parse(input)
    return getPublicMemories({ userId, page, size })
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
    updateTag(`memories:${userId}`)
    updateTag('memories:federated')
}