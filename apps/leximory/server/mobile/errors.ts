import type { MobileErrorBody, MobileErrorCode } from '@repo/schema/mobile'

const failures = {
    unauthenticated: { status: 401, message: 'Sign in to continue.', retryable: false },
    inaccessible: { status: 404, message: 'This item is not available.', retryable: false },
    invalid_input: { status: 400, message: 'The request is invalid.', retryable: false },
    stale_revision: { status: 409, message: 'The passage changed. Open it again.', retryable: false },
    quota_exceeded: { status: 429, message: 'Your definition allowance has been reached.', retryable: false },
    unsupported_format: { status: 422, message: 'This format is not supported in the reading companion.', retryable: false },
    service_unavailable: { status: 503, message: 'The service is temporarily unavailable.', retryable: true },
} satisfies Record<MobileErrorCode, { status: number; message: string; retryable: boolean }>

export class MobileError extends Error {
    constructor(readonly code: MobileErrorCode) {
        super(failures[code].message)
        this.name = 'MobileError'
    }
    get status(): number { return failures[this.code].status }
    get body(): MobileErrorBody {
        const { message, retryable } = failures[this.code]
        return { error: { code: this.code, message, retryable } }
    }
}

export function mobileErrorResponse(error: unknown): Response {
    const failure = error instanceof MobileError ? error : new MobileError('service_unavailable')
    return Response.json(failure.body, {
        status: failure.status,
        headers: {
            'Cache-Control': 'private, no-store',
            ...(failure.code === 'unauthenticated' ? { 'WWW-Authenticate': 'Bearer' } : {}),
        },
    })
}
