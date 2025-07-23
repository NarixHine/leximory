import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SIGN_IN_URL } from '@/lib/config'
import env from '@/lib/env'

export async function updateSession(request: NextRequest, isProtectedRouteChecker: (path: string) => boolean) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
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
        url.pathname = '/library'
        return NextResponse.redirect(url)
    }

    if (
        !user &&
        isProtectedRouteChecker(pathname)
    ) {
        const url = request.nextUrl.clone()
        url.pathname = SIGN_IN_URL
        const response = NextResponse.redirect(url)
        response.cookies.set('next', pathname)
        return response
    }

    return supabaseResponse
}
