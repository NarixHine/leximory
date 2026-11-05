import { z } from 'zod'
import type { AppleEnvironment } from '@repo/user/entitlements'
import { jsonBody } from '../mobile/http'
import { MobileError } from '../mobile/errors'
import { AppleBillingError } from './service'

type Notification = { id: string; environment: AppleEnvironment; chain: string | null }
export function createAppleNotificationHandler({
    verify,
    enqueue,
}: {
    verify(jws: string): Promise<Notification>
    enqueue(notification: Notification & { chain: string }): Promise<void>
}) {
    return async (request: Request) => {
        try {
            const { signedPayload } = z
                .object({ signedPayload: z.string().min(1).max(64000) })
                .strict()
                .parse(await jsonBody(request, 65000))
            const { id, environment, chain } = await verify(signedPayload)
            if (chain) await enqueue({ id, environment, chain })
            return new Response(null, { status: 200 })
        } catch (error) {
            const invalid =
                error instanceof z.ZodError ||
                (error instanceof MobileError && error.code === 'invalid_input') ||
                (error instanceof AppleBillingError && error.reason === 'invalid')
            // Return success only after durable queue acceptance. Infrastructure failures must retry.
            return new Response(null, { status: invalid ? 400 : 503 })
        }
    }
}
