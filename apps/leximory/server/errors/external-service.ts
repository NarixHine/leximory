import 'server-only'

export class ExternalServiceError extends Error {
    readonly name = 'ExternalServiceError'
    constructor(
        readonly service: string,
        readonly code: string,
        readonly retryable: boolean,
        readonly status: number | null,
        cause?: unknown,
    ) {
        super(`${service}: ${code}`, { cause })
    }
}
