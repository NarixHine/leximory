import { serve, workflowOptions } from '@/server/workflows/serve'
import { deleteAccount } from '@/server/workflows/account-deletion'
import { deletionPayload } from '@/server/workflows/contracts'
import { deletionFailed } from '@/server/workflows/account-deletion'

export const maxDuration = 300
export const { POST } = serve(deleteAccount, {
    ...workflowOptions,
    schema: deletionPayload,
    failureFunction: ({ context }) => deletionFailed(context.requestPayload.requestId),
})
