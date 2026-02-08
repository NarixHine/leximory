import 'server-only'
import { getUser } from '@repo/user'

export async function createTRPCContext() {
  const user = await getUser()

  return {
    user,
  }
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>
