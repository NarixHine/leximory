import { isTrustedPathname } from '@/lib/url'
import { getUserOrThrow } from '@repo/user'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    await getUserOrThrow()
    
    const { searchParams } = new URL(request.url)
    const nextParam = searchParams.get('next') || '/'
    if (!isTrustedPathname(nextParam)) {
        throw new Error('Untrusted next URL')
    }
    const next = isTrustedPathname(nextParam) ? nextParam : '/'

    return NextResponse.redirect(next)
}
