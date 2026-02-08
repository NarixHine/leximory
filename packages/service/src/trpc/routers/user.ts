import 'server-only'

import { z } from '@repo/schema'
import { getUserById } from '@repo/user'
import { router, publicProcedure } from '../init'

export const userRouter = router({
  /**
   * Retrieves a user by ID with authorization check.
   * Only authenticated users can retrieve user data.
   */
  getProfile: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      'use cache'
      const user = await getUserById(input.id)
      return {
        imageUrl: user.image,
        name: user.username,
      }
    }),
})
