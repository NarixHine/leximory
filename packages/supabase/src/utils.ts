import { IS_PROD } from '@repo/env'
import { prefixUrl } from '@repo/env/config'
import { seconds } from 'itty-time'

export function cookiesFactory() {
    if (IS_PROD) {
        const domain = new URL(prefixUrl('/')).hostname
        return {
            domain: `.${domain}`,
            path: '/',
            maxAge: seconds('1 year'),
            sameSite: 'lax' as const,
            secure: true,
        }
    }
    else {
        return undefined
    }
}
