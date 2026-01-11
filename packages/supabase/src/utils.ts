import { IS_PROD } from '@repo/env'
import { prefixUrl } from '@repo/env/config'
import { seconds } from 'itty-time'

export function cookiesFactory() {
    const authDomain = new URL(prefixUrl('/')).hostname
    return {
        name: `sb-${authDomain}-auth-token`,
        ...(IS_PROD && { domain: `.${authDomain}` }),
        path: '/',
        maxAge: seconds('1 year'),
        sameSite: 'lax' as const,
    }
}
