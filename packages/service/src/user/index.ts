'use server'

import { actionClient } from '@repo/service'
import { z } from '@repo/schema'
import { Kilpi } from '../kilpi'
import { getUserById } from '@repo/user'

const getUserByIdSchema = z.object({
    id: z.string(),
})

/**
 * Retrieves a user by ID with authorization check.
 * Only authenticated users can retrieve user data.
 */
export const getUserProfileAction = actionClient
    .inputSchema(getUserByIdSchema)
    .action(async ({ parsedInput: { id } }) => {
        await Kilpi.authed().authorize().assert()
        const user = await getUserById(id)
        return {
            imageUrl: user.image,
            name: user.username,
        }
    })
