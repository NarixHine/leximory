import 'server-only'
import { Inngest } from 'inngest'
import type env from '@repo/env'
import { ExternalServiceError } from '../errors/external-service'

type QueueSettings = Pick<
    typeof env,
    'INNGEST_EVENT_KEY' | 'INNGEST_SIGNING_KEY' | 'INNGEST_ENV' | 'INNGEST_DEV' | 'INNGEST_BASE_URL' | 'VERCEL_ENV'
>

export function createInngestClient(settings: QueueSettings, fetcher?: typeof fetch): Inngest {
    const devURL = settings.INNGEST_DEV?.startsWith('http') ? settings.INNGEST_DEV : undefined
    const isDev = settings.INNGEST_DEV === '1' || settings.INNGEST_DEV === 'true' || Boolean(devURL)
    const baseUrl = settings.INNGEST_BASE_URL ?? devURL
    const hosted = settings.VERCEL_ENV === 'preview' || settings.VERCEL_ENV === 'production'
    if (hosted && (isDev || (baseUrl && new URL(baseUrl).protocol !== 'https:')))
        throw new ExternalServiceError('inngest', 'QUEUE_CONFIGURATION_INVALID', false, null)
    return new Inngest({
        id: 'leximory',
        eventKey: settings.INNGEST_EVENT_KEY,
        signingKey: settings.INNGEST_SIGNING_KEY,
        env: settings.INNGEST_ENV,
        isDev,
        baseUrl,
        // The SDK retries up to five sends. Bound each attempt within the mobile route's 60s budget.
        fetch: (url, init) =>
            (fetcher ?? fetch)(url, {
                ...init,
                signal: AbortSignal.any([AbortSignal.timeout(5000), ...(init?.signal ? [init.signal] : [])]),
            }),
    })
}
