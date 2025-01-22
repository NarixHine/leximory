import { LogSnag } from '@logsnag/next/server'
import env from '@/lib/env'

export function logsnagServer() {
    return new LogSnag({
        token: env.LOGSNAG_SECRET_KEY,
        project: env.NEXT_PUBLIC_LOGSNAG_PROJECT,
    })
}
