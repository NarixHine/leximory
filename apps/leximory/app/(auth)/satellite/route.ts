import { isTrustedPathname } from '@/lib/url'
import { prefixUrl } from '@repo/env/config'
import { getUser } from '@repo/user'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const nextParam = searchParams.get('next') || '/'
    if (!isTrustedPathname(nextParam)) {
        throw new Error('Untrusted next URL')
    }

    if (!await getUser()) {
        return NextResponse.redirect(prefixUrl('/login?next=' + encodeURIComponent(nextParam)))
    }

    const next = isTrustedPathname(nextParam) ? nextParam : '/'

    return NextResponse.redirect(next)
}
