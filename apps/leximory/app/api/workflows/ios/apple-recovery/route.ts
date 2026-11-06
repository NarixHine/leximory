import { serve, workflowOptions } from '@/server/workflows/serve'
import { recoverAppleSubscriptions } from '@/server/workflows/apple-billing'

export const maxDuration = 300
export const { POST } = serve(recoverAppleSubscriptions, { ...workflowOptions })
