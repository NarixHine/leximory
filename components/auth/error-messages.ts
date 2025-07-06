import { AuthError } from '@supabase/supabase-js'

// Simplified error message mappings for Supabase Auth errors
export const AUTH_ERROR_MESSAGES = {
    // Authentication & Authorization
    'invalid_credentials': '邮箱或密码错误',
    'not_admin': '需要管理员权限',
    'no_authorization': '需要授权',
    'user_not_found': '用户不存在',
    'user_banned': '账户已被暂时封禁',
    'insufficient_aal': '需要额外身份验证',
    'reauthentication_needed': '请重新登录以继续',
    'reauthentication_not_valid': '验证码无效',

    // Email & Phone
    'email_address_invalid': '请输入有效的邮箱地址',
    'email_exists': '邮箱地址已被注册',
    'email_not_confirmed': '请验证您的邮箱地址',
    'phone_exists': '手机号码已被注册',
    'phone_not_confirmed': '请验证您的手机号码',
    'email_address_not_authorized': '此邮箱地址不允许发送邮件',

    // Sign up & Sign in
    'signup_disabled': '新用户注册功能已关闭',
    'email_provider_disabled': '邮箱注册功能已关闭',
    'phone_provider_disabled': '手机注册功能已关闭',
    'provider_disabled': '该登录方式已被禁用',
    'oauth_provider_not_supported': '不支持该登录提供商',
    'otp_disabled': '一次性密码登录已被禁用',
    'anonymous_provider_disabled': '匿名登录已被禁用',

    // Session & Tokens
    'session_expired': '您的会话已过期，请重新登录',
    'session_not_found': '会话未找到，请重新登录',
    'refresh_token_not_found': '会话已过期，请重新登录',
    'refresh_token_already_used': '会话已过期，请重新登录',
    'bad_jwt': '无效的会话令牌',

    // OTP & Verification
    'otp_expired': '验证码已过期，请重新获取',
    'invite_not_found': '邀请已过期或已被使用',
    'captcha_failed': '验证码验证失败',

    // Rate Limiting
    'over_email_send_rate_limit': '邮件发送过于频繁，请稍后重试',
    'over_sms_send_rate_limit': '短信发送过于频繁，请稍后重试',
    'over_request_rate_limit': '请求过于频繁，请几分钟后重试',

    // MFA (Multi-Factor Authentication)
    'mfa_challenge_expired': '多重身份验证挑战已过期，请重试',
    'mfa_factor_not_found': '多重身份验证方法未找到',
    'mfa_verification_failed': '多重身份验证码无效',
    'mfa_verification_rejected': '多重身份验证被拒绝',
    'mfa_phone_enroll_not_enabled': '手机多重身份验证注册已被禁用',
    'mfa_totp_enroll_not_enabled': 'TOTP多重身份验证注册已被禁用',
    'mfa_web_authn_enroll_not_enabled': 'WebAuthn多重身份验证注册已被禁用',
    'too_many_enrolled_mfa_factors': '已达到多重身份验证方法数量上限',

    // Password
    'weak_password': '密码不符合安全要求',
    'same_password': '新密码必须与当前密码不同',

    // Identity & Linking
    'identity_already_exists': '账户已关联到其他用户',
    'identity_not_found': '账户关联未找到',
    'single_identity_not_deletable': '无法移除唯一的登录方式',
    'manual_linking_disabled': '账户关联功能已被禁用',
    'user_already_exists': '用户已存在',

    // SSO & SAML
    'saml_provider_disabled': '企业单点登录未启用',
    'saml_idp_not_found': '单点登录提供商未找到',
    'sso_provider_not_found': '单点登录提供商未找到',
    'user_sso_managed': '此账户由单点登录管理',

    // Technical Errors
    'bad_json': '请求格式无效',
    'bad_oauth_callback': 'OAuth登录失败',
    'bad_oauth_state': 'OAuth登录失败',
    'conflict': '请求冲突，请重试',
    'request_timeout': '请求超时，请重试',
    'unexpected_failure': '发生意外错误',
    'validation_failed': '输入无效',
    'sms_send_failed': '短信发送失败',

    // Flow States
    'flow_state_expired': '登录会话已过期，请重试',
    'flow_state_not_found': '登录会话未找到，请重试',

    // Default fallback
    'default': '发生错误，请重试'
} as const

export type AuthErrorCode = keyof typeof AUTH_ERROR_MESSAGES

/**
 * Get user-friendly error message for auth error code
 */
export function getAuthErrorMessage(errorCode: AuthError): string {
    return AUTH_ERROR_MESSAGES[errorCode.code as AuthErrorCode] || AUTH_ERROR_MESSAGES.default
}

/**
 * Common error categories for easier handling
 */
export const AUTH_ERROR_CATEGORIES = {
    AUTHENTICATION: [
        'invalid_credentials',
        'user_not_found',
        'session_expired',
        'session_not_found'
    ],
    VERIFICATION: [
        'email_not_confirmed',
        'phone_not_confirmed',
        'otp_expired',
        'captcha_failed'
    ],
    RATE_LIMITING: [
        'over_email_send_rate_limit',
        'over_sms_send_rate_limit',
        'over_request_rate_limit'
    ],
    DISABLED_FEATURES: [
        'signup_disabled',
        'email_provider_disabled',
        'phone_provider_disabled',
        'provider_disabled'
    ],
    MFA: [
        'mfa_challenge_expired',
        'mfa_verification_failed',
        'mfa_factor_not_found'
    ]
} as const
