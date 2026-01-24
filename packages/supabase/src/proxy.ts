import { CookieOptions, createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SIGN_IN_URL } from '@repo/env/config'
import env from '@repo/env'
import { cookiesFactory } from './utils'

export async function updateSession(request: NextRequest, isProtectedRouteChecker: (path: string) => boolean, authedHomepageRedirectPathname = '/library') {
    let response = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookieOptions: cookiesFactory(),
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    // 2. Update the request cookies (so the Server Component can see the change)
                    request.cookies.set({ name, value, ...options })
                    // 3. Update the response cookies (so the browser saves the change)
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({ name, value, ...options })
                },
                remove(name: string, options: CookieOptions) {
                    // 4. Handle cookie removal (sign out)
                    request.cookies.set({ name, value: '', ...options })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({ name, value: '', ...options })
                },
            },
        }
    )

    const {
        data: { user },
    } = await supabase.auth.getUser()

    const { pathname } = request.nextUrl
    if (user && pathname === '/') {
        const url = request.nextUrl.clone()
        url.pathname = authedHomepageRedirectPathname
        return NextResponse.redirect(url)
    }

    if (
        !user &&
        isProtectedRouteChecker(pathname)
    ) {
        const url = request.nextUrl.clone()
        url.pathname = SIGN_IN_URL
        url.searchParams.set('next', pathname)
        const response = NextResponse.redirect(url)
        return response
    }

    return response
}
