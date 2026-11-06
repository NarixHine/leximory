import { serve, workflowOptions } from '@/server/workflows/serve'
import { reconcileAppleSubscription } from '@/server/workflows/apple-billing'
import { applePayload } from '@/server/workflows/contracts'

export const maxDuration = 300
export const { POST } = serve(reconcileAppleSubscription, { ...workflowOptions, schema: applePayload })
