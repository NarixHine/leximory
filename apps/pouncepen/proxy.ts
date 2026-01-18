import { ProxyConfig, NextRequest, NextResponse } from 'next/server'

export async function proxy(request: NextRequest) {
    return NextResponse.next()
}

export const config: ProxyConfig = {
    matcher: ['/user/:path*', '/assignment/:path*'],
}
