import 'server-only'

import { z } from '@repo/schema'
import { shadowSaveWord, loadWords } from '@repo/supabase/word'
import { getShadowLib } from '@repo/supabase/library'
import { extractSaveForm } from '@repo/utils'
import { router, authedProcedure } from '../init'

export const wordRouter = router({
  /**
   * Saves a comment word in the English shadow library
   * of the authenticated user.
   */
  save: authedProcedure
    .input(z.object({
      portions: z.array(z.string()),
    }))
    .mutation(async ({ input, ctx }) => {
      const word = `{{${extractSaveForm(input.portions.filter(Boolean)).join('||')}}}`
      const { id } = await shadowSaveWord({ word, uid: ctx.user.userId, lang: 'en' })
      return id
    }),

  /**
   * Retrieves recent words saved by the user
   * in the shadow English library.
   */
  getRecent: authedProcedure
    .input(z.object({
      cursor: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const shadowLib = await getShadowLib({ owner: ctx.user.userId, lang: 'en' })
      return await loadWords({ lib: shadowLib.id, cursor: input.cursor })
    }),
})
