import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { prefixUrl, SIGN_IN_URL } from '@repo/env/config'
import env from '@repo/env'
import { cookiesFactory } from './utils'
export { type NextRequest } from 'next/server'

export async function updateSession(
    request: NextRequest,
    isProtectedRouteChecker: (path: string) => boolean,
    authedHomepageRedirectPathname?: string
) {
    // 1. Create the response object ONCE.
    // We will mutate this object inside setAll to add cookies.
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookieOptions: cookiesFactory(),
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        // Update Request (so Server Components see the new session immediately)
                        request.cookies.set({
                            name,
                            value,
                            ...options,
                        })

                        // Update Response (so the Browser saves the new session)
                        supabaseResponse.cookies.set({
                            name,
                            value,
                            ...options,
                        })
                    })
                },
            },
        }
    )

    // 3. Use getClaims() for performance (no DB hit)
    // This validates the JWT signature and expiration.
    const { data, error } = await supabase.auth.getClaims()

    // If there is no error and we have claims, the user is authenticated.
    const user = !error && data?.claims

    const { pathname } = request.nextUrl

    // --- Logic: Redirect Authenticated User from Root to Dashboard ---
    if (user && pathname === '/' && authedHomepageRedirectPathname) {
        const url = request.nextUrl.clone()
        url.pathname = authedHomepageRedirectPathname

        // Create the redirect response
        const redirectResponse = NextResponse.redirect(url)

        // IMPORTANT: Copy any cookies set during 'getClaims' (refreshes) to this new response
        copyCookies(supabaseResponse, redirectResponse)

        return redirectResponse
    }

    // --- Logic: Redirect Unauthenticated User from Protected Routes ---
    if (!user && isProtectedRouteChecker(pathname)) {
        const url = request.nextUrl.clone()
        url.searchParams.set('next', url.href)
        url.host = new URL(prefixUrl('')).host
        url.pathname = SIGN_IN_URL

        const redirectResponse = NextResponse.redirect(url)

        // IMPORTANT: Even on logout/redirect, we might need to clear cookies
        copyCookies(supabaseResponse, redirectResponse)

        return redirectResponse
    }

    return supabaseResponse
}

// Helper to preserve cookies when switching response objects (e.g. redirects)
function copyCookies(source: NextResponse, destination: NextResponse) {
    const sourceCookies = source.cookies.getAll()
    sourceCookies.forEach((cookie) => {
        destination.cookies.set(cookie)
    })
}
