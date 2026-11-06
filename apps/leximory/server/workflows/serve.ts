import 'server-only'
import { serve as serveWorkflow } from '@upstash/workflow/nextjs'
import type { RouteFunction, WorkflowServeOptions } from '@upstash/workflow'
import env from '@repo/env'
import { Receiver } from '@upstash/qstash'

// Explicit verification also protects initial invocations, including the recovery schedule.
export const workflowOptions = {
    receiver: new Receiver({
        currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
        nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
    }),
    env: {
        QSTASH_URL: env.QSTASH_URL,
        QSTASH_TOKEN: env.QSTASH_TOKEN,
        QSTASH_CURRENT_SIGNING_KEY: env.QSTASH_CURRENT_SIGNING_KEY,
        QSTASH_NEXT_SIGNING_KEY: env.QSTASH_NEXT_SIGNING_KEY,
    },
}
export function serve<T>(handler: RouteFunction<T>, options: WorkflowServeOptions<T>) {
    const workflow = serveWorkflow(handler, options)
    return {
        POST: async (request: Request) => {
            if (!request.headers.get('upstash-signature')) return new Response(null, { status: 403 })
            return workflow.POST(request)
        },
    }
}
