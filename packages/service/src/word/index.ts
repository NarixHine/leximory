'use server'
import { shadowSaveWord } from '@repo/supabase/word'
import { getUserOrThrow } from '@repo/user'
import { extractSaveForm } from '@repo/utils'
import { actionClient } from '../safe-action-client'
import { z } from '@repo/schema'

/**
 * Saves a comment word in the English shadow library
 * of the authenticated user.
 */
export const saveWordAction = actionClient
    .inputSchema(z.object({
        portions: z.array(z.string()),
    }))
    .action(async ({ parsedInput: { portions } }) => {
        const word = `{{${extractSaveForm(portions.filter(Boolean)).join('||')}}}`

        const { userId } = await getUserOrThrow()
        const { id } = await shadowSaveWord({ word, uid: userId, lang: 'en' })
        return id
    })
