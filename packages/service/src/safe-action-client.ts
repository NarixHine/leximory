import { createSafeActionClient } from 'next-safe-action'

export { useAction } from 'next-safe-action/hooks'
export const actionClient = createSafeActionClient()
