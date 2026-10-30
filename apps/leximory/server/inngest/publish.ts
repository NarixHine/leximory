import 'server-only'
import type { Inngest, EventPayload } from 'inngest'
import { z } from 'zod'
import { ExternalServiceError } from '../errors/external-service'
import { articleImported, articleImportEventSchema } from './events'

export function queuePublishError(cause: unknown): ExternalServiceError {
    if (cause instanceof ExternalServiceError) return cause
    const message = cause instanceof Error ? cause.message : ''
    const match = /Inngest API Error:\s*(\d{3})\s*([\s\S]*)/.exec(message)
    const status = match ? Number(match[1]) : null
    let code = 'QUEUE_UNKNOWN_FAILURE'
    let retryable = true
    if (status !== null) {
        retryable = status === 429 || status >= 500
        if ([400, 403, 404].includes(status) && /environment|branch/i.test(match?.[2] ?? ''))
            code = 'QUEUE_ENVIRONMENT_REJECTED'
        else if ([401, 403, 404].includes(status)) code = 'QUEUE_AUTHENTICATION_REJECTED'
        else if (status === 429) code = 'QUEUE_RATE_LIMITED'
        else if (status >= 500) code = 'QUEUE_UNAVAILABLE'
        else code = 'QUEUE_PAYLOAD_REJECTED'
    } else if (/couldn't find an event key|event key.*missing/i.test(message)) {
        code = 'QUEUE_CONFIGURATION_INVALID'
        retryable = false
    } else if (/validation failed/i.test(message) || cause instanceof z.ZodError) {
        code = 'QUEUE_PAYLOAD_REJECTED'
        retryable = false
    } else if (cause instanceof DOMException && cause.name === 'TimeoutError') code = 'QUEUE_TIMEOUT'
    else if (cause instanceof TypeError) code = 'QUEUE_NETWORK_FAILURE'
    return new ExternalServiceError('inngest', code, retryable, status, cause)
}

export function createEventPublisher(client: Inngest) {
    return async (event: EventPayload): Promise<{ eventId: string }> => {
        try {
            const result = await client.send(event)
            const receipt = z.object({ ids: z.tuple([z.string().min(1)]) }).safeParse(result)
            if (!receipt.success) throw new ExternalServiceError('inngest', 'QUEUE_ACKNOWLEDGEMENT_INVALID', true, null)
            return { eventId: receipt.data.ids[0] }
        } catch (error) {
            throw queuePublishError(error)
        }
    }
}

export function createArticlePublisher(client: Inngest) {
    const publish = createEventPublisher(client)
    return async (input: { id?: string; data: z.infer<typeof articleImportEventSchema> }) => {
        // The SDK discards schema error types, so classify validation before handing it the event.
        const parsed = articleImportEventSchema.safeParse(input.data)
        if (!parsed.success)
            throw new ExternalServiceError('inngest', 'QUEUE_PAYLOAD_REJECTED', false, null, parsed.error)
        return publish(articleImported.create(parsed.data, { id: input.id }))
    }
}
