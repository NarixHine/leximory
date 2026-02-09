import 'server-only'
import { initTRPC, TRPCError } from '@trpc/server'
import type { Context } from './context'
import { Kilpi } from '../kilpi'

const t = initTRPC.context<Context>().create()

export const router = t.router
export const publicProcedure = t.procedure

/**
 * Authenticated procedure - requires user to be logged in
 */
export const authedProcedure = t.procedure.use(async (opts) => {
  const { ctx } = opts
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' })
  }

  // Also verify with Kilpi
  await Kilpi.authed().authorize().assert()

  return opts.next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  })
})
