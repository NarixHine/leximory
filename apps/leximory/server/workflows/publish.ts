import 'server-only'
import { createHash } from 'node:crypto'
import { Client, type TriggerOptions } from '@upstash/workflow'
import type env from '@repo/env'
import { z } from 'zod'
import { ExternalServiceError } from '../errors/external-service'
import { articleImportEventSchema, applePayload, deletionPayload } from './contracts'

type Settings = Pick<typeof env, 'QSTASH_URL' | 'QSTASH_TOKEN' | 'NEXT_PUBLIC_LEXIMORY_URL' | 'VERCEL_ENV'>

function flowKey(scope: string, owner: string) {
    return `${scope}.${createHash('sha256').update(owner).digest('hex')}`
}

export function createWorkflowPublisher(settings: Settings) {
    const hosted = settings.VERCEL_ENV === 'preview' || settings.VERCEL_ENV === 'production'
    const origin = settings.NEXT_PUBLIC_LEXIMORY_URL
    if (hosted && [origin, settings.QSTASH_URL].some((url) => new URL(url).protocol !== 'https:'))
        throw new ExternalServiceError('upstash-workflow', 'QUEUE_CONFIGURATION_INVALID', false, null)
    const client = new Client({ token: settings.QSTASH_TOKEN, baseUrl: settings.QSTASH_URL, retry: false })
    async function trigger(
        path: string,
        body: unknown,
        id: string | undefined,
        flowControl: TriggerOptions['flowControl'],
    ) {
        try {
            const receipt = await client.trigger({
                url: new URL(`/api/workflows/ios/${path}`, origin).href,
                body,
                workflowRunId: id,
                retries: 5,
                flowControl,
                disableTelemetry: true,
            })
            return { eventId: receipt.workflowRunId }
        } catch (error) {
            if (error instanceof ExternalServiceError) throw error
            const status =
                error && typeof error === 'object' && 'status' in error && typeof error.status === 'number'
                    ? error.status
                    : null
            if (status !== null)
                throw new ExternalServiceError(
                    'upstash-workflow',
                    status === 429
                        ? 'QUEUE_RATE_LIMITED'
                        : status >= 500
                          ? 'QUEUE_UNAVAILABLE'
                          : [401, 403, 404].includes(status)
                            ? 'QUEUE_AUTHENTICATION_REJECTED'
                            : 'QUEUE_PAYLOAD_REJECTED',
                    status === 429 || status >= 500,
                    status,
                    error,
                )
            const code =
                error instanceof DOMException && error.name === 'TimeoutError'
                    ? 'QUEUE_TIMEOUT'
                    : error instanceof TypeError
                      ? 'QUEUE_NETWORK_FAILURE'
                      : 'QUEUE_UNKNOWN_FAILURE'
            throw new ExternalServiceError('upstash-workflow', code, true, null, error)
        }
    }
    function parse<T>(schema: z.ZodType<T>, data: unknown): T {
        const result = schema.safeParse(data)
        if (!result.success)
            throw new ExternalServiceError('upstash-workflow', 'QUEUE_PAYLOAD_REJECTED', false, null, result.error)
        return result.data
    }
    return {
        publishArticleImport: (input: { id?: string; data: z.infer<typeof articleImportEventSchema> }) => {
            const body = parse(articleImportEventSchema, input.data)
            return trigger('article-annotation', body, input.id, {
                key: flowKey('ios-article', body.userId),
                parallelism: 2,
            })
        },
        publishAppleSubscription: (input: z.infer<typeof applePayload>, id?: string) => {
            const body = parse(applePayload, input)
            return trigger('apple-subscription', body, id, {
                key: flowKey('apple', JSON.stringify([body.environment, body.chain])),
                parallelism: 1,
            })
        },
        publishAccountDeletion: (requestId: string, attempt: string) =>
            trigger(
                'account-deletion',
                parse(deletionPayload, { requestId }),
                `account-deletion:${requestId}:${attempt}`,
                { key: flowKey('account-deletion', requestId), parallelism: 1 },
            ),
    }
}
