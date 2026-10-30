import { z } from 'zod'
import type { MobileErrorBody, MobileErrorCode } from '@repo/schema/mobile'

const failures = {
    purchase_account_mismatch: {
        status: 409,
        message: '此订阅属于另一个 Leximory 账号，请登录购买时使用的账号后恢复。',
        retryable: false,
    },
    unauthenticated: { status: 401, message: '请登录后继续。', retryable: false },
    inaccessible: { status: 404, message: '此内容暂不可用。', retryable: false },
    invalid_input: { status: 400, message: '请求无效，请重试。', retryable: false },
    stale_revision: { status: 409, message: '文章已更新，请重新打开。', retryable: false },
    quota_exceeded: { status: 429, message: '本期词点额度已用完。', retryable: false },
    unsupported_format: { status: 422, message: 'iOS 版暂不支持此格式。', retryable: false },
    language_unresolved: {
        status: 422,
        message: '暂时无法识别这段文字的语言，请选择更完整的词句后重试。',
        retryable: false,
    },
    service_unavailable: { status: 503, message: '服务暂时不可用，请稍后重试。', retryable: true },
} satisfies Record<MobileErrorCode, { status: number; message: string; retryable: boolean }>

export class MobileError extends Error {
    constructor(
        readonly code: MobileErrorCode,
        options?: ErrorOptions,
    ) {
        super(failures[code].message, options)
        this.name = 'MobileError'
    }
    get status(): number {
        return failures[this.code].status
    }
    get body(): MobileErrorBody {
        const { message, retryable } = failures[this.code]
        return { error: { code: this.code, message, retryable } }
    }
}

type MobileDependencyStep =
    | 'article.lookup'
    | 'article.persist'
    | 'article.confirm'
    | 'annotation.quota'
    | 'annotation.enqueue'
export class MobileDependencyError extends MobileError {
    constructor(
        readonly step: MobileDependencyStep,
        cause: unknown,
    ) {
        super(cause instanceof MobileError ? cause.code : 'service_unavailable', { cause })
    }
}

export async function mobileDependency<T>(step: MobileDependencyStep, operation: () => PromiseLike<T>): Promise<T> {
    try {
        return await operation()
    } catch (error) {
        throw new MobileDependencyError(step, error)
    }
}

export function mobileErrorResponse(error: unknown): Response {
    const failure =
        error instanceof MobileError
            ? error
            : new MobileError(error instanceof z.ZodError ? 'invalid_input' : 'service_unavailable')
    return Response.json(failure.body, {
        status: failure.status,
        headers: {
            'Cache-Control': 'private, no-store',
            ...(failure.code === 'unauthenticated' ? { 'WWW-Authenticate': 'Bearer' } : {}),
        },
    })
}

export function mobileErrorFromStatus(status: number): MobileError {
    switch (status) {
        case 400:
            return new MobileError('invalid_input')
        case 401:
            return new MobileError('unauthenticated')
        case 403:
        case 404:
            return new MobileError('inaccessible')
        case 409:
            return new MobileError('stale_revision')
        case 422:
            return new MobileError('unsupported_format')
        case 429:
            return new MobileError('quota_exceeded')
        default:
            return new MobileError('service_unavailable')
    }
}
