'use server'
import { shadowSaveWord, loadWords } from '@repo/supabase/word'
import { getShadowLib } from '@repo/supabase/library'
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

/**
 * Retrieves recent words saved by the user
 *  in the shadow English library.
 */
export const getRecentWordsAction = actionClient
    .inputSchema(z.object({
        cursor: z.string().optional(),
    }))
    .action(async ({ parsedInput: { cursor } }) => {
        const { userId } = await getUserOrThrow()
        const shadowLib = await getShadowLib({ owner: userId, lang: 'en' })
        return await loadWords({ lib: shadowLib.id, cursor })
    })
